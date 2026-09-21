'use strict';

const EventEmitter = require('events');
const InnertubeService = require('./services/innertubeService');
const { resolveVideoId } = require('./services/urlResolver');
const { parseInitialStreamInfo, parseUpdatedMetadataActions } = require('./parsers/metadataParser');
const { HandlerRegistry } = require('./handlers');

class YouTubeLiveConnector extends EventEmitter {
  /**
   * @param {object|string} [options] Connection options or YouTube URL / Video ID / Channel handle (e.g. "@username")
   * @param {string} [options.url] YouTube Live stream URL, Video ID, or Channel handle
   * @param {string} [options.liveId] YouTube Video ID (alias)
   * @param {string} [options.channel] Channel URL, handle, or username e.g. @ChannelName
   * @param {string} [options.username] Channel handle or username e.g. @ChannelName (alias)
   * @param {string} [options.uniqueId] Channel username alias (for TikTokLiveConnector compatibility)
   * @param {boolean} [options.pollViewers=true] Enable continuous polling of live viewer count
   * @param {number} [options.viewerIntervalMs=5000] Interval for polling live viewers (default 5000ms)
   * @param {number} [options.chatIntervalMs] Override chat polling interval (defaults to YouTube recommendation)
   * @param {boolean} [options.ignoreInitialChat=false] Skip emitting chat items present on initial page load
   * @param {boolean} [options.autoDisconnectOnEnd=true] Automatically disconnect when stream ends
   * @param {object} [options.headers] Custom HTTP headers
   */
  constructor(options = {}) {
    super();

    if (typeof options === 'string') {
      options = { url: options };
    }

    let rawInput = options.url || options.liveId || options.channel || options.username || options.uniqueId || null;
    if (typeof rawInput === 'string') {
      rawInput = rawInput.trim();
    }

    this.initialUrl = rawInput;
    this.username = options.username || options.uniqueId || (typeof rawInput === 'string' && rawInput.startsWith('@') ? rawInput : null);
    this.pollViewersEnabled = options.pollViewers !== false;
    this.viewerIntervalMs = options.viewerIntervalMs || 5000;
    this.chatIntervalOverride = options.chatIntervalMs || null;
    this.ignoreInitialChat = options.ignoreInitialChat === true;
    this.autoDisconnectOnEnd = options.autoDisconnectOnEnd !== false;

    this.innertube = new InnertubeService({
      headers: options.headers
    });

    this.videoId = null;
    this.streamInfo = null;
    this.connected = false;

    // Polling states & timers
    this.chatContinuation = null;
    this.metadataContinuation = null;
    this.chatTimer = null;
    this.viewerTimer = null;

    // Deduplication set for processed message IDs
    this.processedMessageIds = new Set();
    this.maxCachedMessageIds = 10000;

    // OOP Event Handlers Registry (1 event / feature per file)
    this.handlers = new HandlerRegistry(this);
  }

  // --- Backward-Compatible State Proxies ---
  get lastLikeCount() { return this.handlers.like.lastLikeCount; }
  set lastLikeCount(val) { this.handlers.like.lastLikeCount = val; }

  get lastReactionUpdateTimeUsec() { return this.handlers.reaction.lastReactionUpdateTimeUsec; }
  set lastReactionUpdateTimeUsec(val) { this.handlers.reaction.lastReactionUpdateTimeUsec = val; }

  get chatEndRetries() { return this.handlers.lifecycle.chatEndRetries; }
  set chatEndRetries(val) { this.handlers.lifecycle.chatEndRetries = val; }

  get maxChatEndRetries() { return this.handlers.lifecycle.maxChatEndRetries; }
  set maxChatEndRetries(val) { this.handlers.lifecycle.maxChatEndRetries = val; }

  get _hasEnded() { return this.handlers.lifecycle.hasEnded; }
  set _hasEnded(val) { this.handlers.lifecycle.hasEnded = val; }

  /**
   * Connect to YouTube Live
   * @param {string} [url] Optional YouTube Live URL, Video ID, or Channel Username e.g. "@username"
   * @returns {Promise<object>} Returns streamInfo
   */
  async connect(url) {
    if (this.connected) {
      throw new Error('Connector is already connected. Call disconnect() first.');
    }

    const targetUrl = url ? (typeof url === 'string' ? url.trim() : url) : this.initialUrl;
    if (!targetUrl) {
      throw new Error('No YouTube URL, Video ID, or Channel Username provided.');
    }

    try {
      // 1. Resolve to an active 11-character Video ID
      const resolved = await resolveVideoId(targetUrl, {
        headers: this.innertube.customHeaders
      });
      this.videoId = resolved.videoId;

      // 2. Fetch watch page to get initial stream info and viewer count
      const { ytInitialData } = await this.innertube.fetchWatchPage(this.videoId);
      this.streamInfo = parseInitialStreamInfo(ytInitialData, this.videoId);
      this.streamInfo.url = resolved.finalUrl;

      // Initialize like count in LikeHandler
      this.handlers.like.initialize(this.streamInfo.likeCount, this.streamInfo.likeCountDisplay);

      // 3. Fetch live_chat page to obtain initial chat continuation token
      const chatPage = await this.innertube.fetchLiveChatPage(this.videoId);
      this.chatContinuation = chatPage.continuation;

      this.connected = true;
      this.handlers.reset();

      // Emit connected event
      this.emit('connected', { ...this.streamInfo });

      // Initialize viewers count in ViewerHandler
      this.handlers.viewer.initialize(this.streamInfo.viewerCount, this.streamInfo.viewerCountDisplay);

      // If chat is disabled, warn user
      if (chatPage.isDisabled) {
        this.emit('warning', {
          type: 'chat_disabled',
          message: 'Live chat is disabled for this stream.'
        });
      }

      // Process initial reactions if present (unless ignoreInitialChat is true)
      if (chatPage.frameworkUpdates?.entityBatchUpdate?.mutations && !this.ignoreInitialChat) {
        this.handlers.dispatchFramework(chatPage.frameworkUpdates.entityBatchUpdate.mutations);
      }

      // Process initial chat messages if present (unless ignoreInitialChat is true)
      if (chatPage.liveChatRenderer?.actions && !this.ignoreInitialChat) {
        this.handlers.dispatchActions(chatPage.liveChatRenderer.actions);
      }

      // 4. Start chat polling loop
      if (this.chatContinuation) {
        const initialDelay = this.chatIntervalOverride || chatPage.timeoutMs || 2000;
        this._scheduleChatPoll(initialDelay);
      }

      // 5. Start viewer count polling loop
      if (this.pollViewersEnabled) {
        const viewerDelay = this.streamInfo.updatedMetadataEndpoint?.updatedMetadataEndpoint?.initialDelayMs || this.viewerIntervalMs;
        this._scheduleViewerPoll(viewerDelay);
      }

      return this.streamInfo;
    } catch (err) {
      this.disconnect();
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Schedule next chat poll
   * @private
   */
  _scheduleChatPoll(delayMs) {
    if (!this.connected) return;
    this.chatTimer = setTimeout(async () => {
      await this._pollChat();
    }, Math.max(delayMs, 1000));
  }

  /**
   * Poll chat actions continuation
   * @private
   */
  async _pollChat() {
    if (!this.connected || !this.chatContinuation) return;

    try {
      const res = await this.innertube.fetchLiveChatContinuation(this.chatContinuation);

      // 1. Dispatch framework reactions to ReactionHandler
      if (res.frameworkUpdates?.entityBatchUpdate?.mutations) {
        this.handlers.dispatchFramework(res.frameworkUpdates.entityBatchUpdate.mutations);
      }

      // 2. Dispatch chat & gift actions to action handlers
      if (res.actions && res.actions.length > 0) {
        this.handlers.dispatchActions(res.actions);
      }

      // 3. Handle continuation with StreamLifecycleHandler
      const hasContinuation = this.handlers.lifecycle.handleChatContinuation(res.nextContinuation);
      if (hasContinuation) {
        this.chatContinuation = res.nextContinuation;
        const nextDelay = this.chatIntervalOverride || res.timeoutMs || 2000;
        this._scheduleChatPoll(nextDelay);
      } else if (!this.handlers.lifecycle.hasEnded) {
        // Retry polling continuation until max retries reached
        this._scheduleChatPoll(5000);
      }
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404')) {
        this.handlers.lifecycle.handleStreamEnded('Video not found or stream removed');
        return;
      }
      this.emit('error', err);
      // Retry chat polling with fallback delay
      this._scheduleChatPoll(4000);
    }
  }

  /**
   * Schedule next viewer metadata poll
   * @private
   */
  _scheduleViewerPoll(delayMs) {
    if (!this.connected || !this.pollViewersEnabled) return;
    this.viewerTimer = setTimeout(async () => {
      await this._pollViewers();
    }, Math.max(delayMs, 3000));
  }

  /**
   * Poll viewer count and stream status via updated_metadata endpoint
   * @private
   */
  async _pollViewers() {
    if (!this.connected || !this.pollViewersEnabled) return;

    try {
      const res = await this.innertube.fetchUpdatedMetadata(this.videoId, this.metadataContinuation);

      if (res.actions && res.actions.length > 0) {
        const updates = parseUpdatedMetadataActions(res.actions);
        this.handlers.dispatchMetadata(updates, { videoId: this.videoId });

        // If stream ended was detected, stop scheduling viewer polling
        if (this.handlers.lifecycle.hasEnded) {
          return;
        }
      }

      if (res.nextContinuation) {
        this.metadataContinuation = res.nextContinuation;
      }

      const nextDelay = res.timeoutMs || this.viewerIntervalMs;
      this._scheduleViewerPoll(nextDelay);
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404')) {
        this.handlers.lifecycle.handleStreamEnded('Video not found or stream removed');
        return;
      }
      // Don't kill entire connector if only viewer poll fails once
      this._scheduleViewerPoll(this.viewerIntervalMs * 2);
    }
  }

  /**
   * Check if message ID has already been emitted (Deduplication)
   * @private
   */
  _isDuplicate(id) {
    if (!id) return false;
    if (this.processedMessageIds.has(id)) return true;

    this.processedMessageIds.add(id);

    // Evict oldest entries if cache exceeds limit
    if (this.processedMessageIds.size > this.maxCachedMessageIds) {
      const firstKey = this.processedMessageIds.values().next().value;
      this.processedMessageIds.delete(firstKey);
    }

    return false;
  }

  // --- Backward-Compatible Delegate Methods ---
  _processActions(actions) {
    this.handlers.dispatchActions(actions);
  }

  _processReactions(mutations) {
    this.handlers.dispatchFramework(mutations);
  }

  _emitViewerCount(viewerCount, viewerCountDisplay) {
    this.handlers.viewer.emitViewers(viewerCount, viewerCountDisplay);
  }

  _handleStreamEnded(reason = 'Stream ended') {
    this.handlers.lifecycle.handleStreamEnded(reason);
  }

  /**
   * Disconnect and clear all timers
   * @param {string} [reason='Manual disconnect']
   */
  disconnect(reason = 'Manual disconnect') {
    if (!this.connected) return;

    this.connected = false;

    if (this.chatTimer) {
      clearTimeout(this.chatTimer);
      this.chatTimer = null;
    }

    if (this.viewerTimer) {
      clearTimeout(this.viewerTimer);
      this.viewerTimer = null;
    }

    this.chatContinuation = null;
    this.metadataContinuation = null;
    this.handlers.reset();

    this.emit('disconnected', { reason });
  }

  /**
   * Check connection status
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get current stream information
   * @returns {object|null}
   */
  getStreamInfo() {
    return this.streamInfo;
  }
}

module.exports = YouTubeLiveConnector;
