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

    const opts = typeof options === 'string' ? { url: options } : options;
    const rawInput = (opts.url || opts.liveId || opts.channel || opts.username || opts.uniqueId || '')?.trim?.() || null;

    this.initialUrl = rawInput;
    this.username = opts.username || opts.uniqueId || (typeof rawInput === 'string' && rawInput.startsWith('@') ? rawInput : null);
    this.pollViewersEnabled = opts.pollViewers !== false;
    this.viewerIntervalMs = opts.viewerIntervalMs || 5000;
    this.chatIntervalOverride = opts.chatIntervalMs || null;
    this.ignoreInitialChat = opts.ignoreInitialChat === true;
    this.autoDisconnectOnEnd = opts.autoDisconnectOnEnd !== false;

    this.innertube = new InnertubeService({ headers: opts.headers });
    this.videoId = null;
    this.streamInfo = null;
    this.connected = false;

    // Polling states & timers
    this.chatContinuation = null;
    this.metadataContinuation = null;
    this.chatTimer = null;
    this.viewerTimer = null;

    // Deduplication cache
    this.processedMessageIds = new Set();
    this.maxCachedMessageIds = 10000;

    // Event Handlers Registry
    this.handlers = new HandlerRegistry(this);
  }

  // Backward-compatible state proxies
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

    const targetUrl = (typeof url === 'string' ? url.trim() : url) || this.initialUrl;
    if (!targetUrl) {
      throw new Error('No YouTube URL, Video ID, or Channel Username provided.');
    }

    try {
      // 1. Resolve to an active 11-character Video ID
      const resolved = await resolveVideoId(targetUrl, { headers: this.innertube.customHeaders });
      this.videoId = resolved.videoId;

      // 2. Fetch watch page to get initial stream info
      const { ytInitialData } = await this.innertube.fetchWatchPage(this.videoId);
      this.streamInfo = parseInitialStreamInfo(ytInitialData, this.videoId);
      this.streamInfo.url = resolved.finalUrl;
      this.handlers.like.initialize(this.streamInfo.likeCount, this.streamInfo.likeCountDisplay);

      // 3. Fetch live_chat page to obtain initial chat continuation token
      const chatPage = await this.innertube.fetchLiveChatPage(this.videoId);
      this.chatContinuation = chatPage.continuation;

      this.connected = true;
      this.handlers.reset();
      this.emit('connected', { ...this.streamInfo });
      this.handlers.viewer.initialize(this.streamInfo.viewerCount, this.streamInfo.viewerCountDisplay);

      if (chatPage.isDisabled) {
        this.emit('warning', { type: 'chat_disabled', message: 'Live chat is disabled for this stream.' });
      }

      // Process initial reactions & chat items unless ignored
      if (!this.ignoreInitialChat) {
        if (chatPage.frameworkUpdates?.entityBatchUpdate?.mutations) {
          this.handlers.dispatchFramework(chatPage.frameworkUpdates.entityBatchUpdate.mutations);
        }
        if (chatPage.liveChatRenderer?.actions) {
          this.handlers.dispatchActions(chatPage.liveChatRenderer.actions);
        }
      }

      // 4. Start polling loops
      if (this.chatContinuation) {
        this._scheduleChatPoll(this.chatIntervalOverride || chatPage.timeoutMs || 2000);
      }
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

  _clearTimers() {
    if (this.chatTimer) {
      clearTimeout(this.chatTimer);
      this.chatTimer = null;
    }
    if (this.viewerTimer) {
      clearTimeout(this.viewerTimer);
      this.viewerTimer = null;
    }
  }

  _scheduleChatPoll(delayMs) {
    if (!this.connected) return;
    this.chatTimer = setTimeout(async () => {
      await this._pollChat();
    }, Math.max(delayMs, 1000));
  }

  async _pollChat() {
    if (!this.connected || !this.chatContinuation) return;

    try {
      const res = await this.innertube.fetchLiveChatContinuation(this.chatContinuation);

      if (res.frameworkUpdates?.entityBatchUpdate?.mutations) {
        this.handlers.dispatchFramework(res.frameworkUpdates.entityBatchUpdate.mutations);
      }
      if (res.actions?.length > 0) {
        this.handlers.dispatchActions(res.actions);
      }

      const hasContinuation = this.handlers.lifecycle.handleChatContinuation(res.nextContinuation);
      if (hasContinuation) {
        this.chatContinuation = res.nextContinuation;
        this._scheduleChatPoll(this.chatIntervalOverride || res.timeoutMs || 2000);
      } else if (!this.handlers.lifecycle.hasEnded) {
        this._scheduleChatPoll(5000);
      }
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404')) {
        this.handlers.lifecycle.handleStreamEnded('Video not found or stream removed');
        return;
      }
      this.emit('error', err);
      this._scheduleChatPoll(4000);
    }
  }

  _scheduleViewerPoll(delayMs) {
    if (!this.connected || !this.pollViewersEnabled) return;
    this.viewerTimer = setTimeout(async () => {
      await this._pollViewers();
    }, Math.max(delayMs, 3000));
  }

  async _pollViewers() {
    if (!this.connected || !this.pollViewersEnabled) return;

    try {
      const res = await this.innertube.fetchUpdatedMetadata(this.videoId, this.metadataContinuation);

      if (res.actions?.length > 0) {
        const updates = parseUpdatedMetadataActions(res.actions);
        this.handlers.dispatchMetadata(updates, { videoId: this.videoId });
        if (this.handlers.lifecycle.hasEnded) return;
      }

      if (res.nextContinuation) {
        this.metadataContinuation = res.nextContinuation;
      }

      this._scheduleViewerPoll(res.timeoutMs || this.viewerIntervalMs);
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404')) {
        this.handlers.lifecycle.handleStreamEnded('Video not found or stream removed');
        return;
      }
      this._scheduleViewerPoll(this.viewerIntervalMs * 2);
    }
  }

  _isDuplicate(id) {
    if (!id) return false;
    if (this.processedMessageIds.has(id)) return true;

    this.processedMessageIds.add(id);
    if (this.processedMessageIds.size > this.maxCachedMessageIds) {
      const firstKey = this.processedMessageIds.values().next().value;
      this.processedMessageIds.delete(firstKey);
    }

    return false;
  }

  // Backward-compatible delegates
  _processActions(actions) { this.handlers.dispatchActions(actions); }
  _processReactions(mutations) { this.handlers.dispatchFramework(mutations); }
  _emitViewerCount(vc, vcd) { this.handlers.viewer.emitViewers(vc, vcd); }
  _handleStreamEnded(reason = 'Stream ended') { this.handlers.lifecycle.handleStreamEnded(reason); }

  /**
   * Disconnect and clear all timers
   * @param {string} [reason='Manual disconnect']
   */
  disconnect(reason = 'Manual disconnect') {
    if (!this.connected) return;

    this.connected = false;
    this._clearTimers();
    this.chatContinuation = null;
    this.metadataContinuation = null;
    this.handlers.reset();

    this.emit('disconnected', { reason });
  }

  isConnected() { return this.connected; }
  getStreamInfo() { return this.streamInfo; }
}

module.exports = YouTubeLiveConnector;
