'use strict';

const EventEmitter = require('events');
const InnertubeService = require('./services/innertubeService');
const { resolveVideoId } = require('./services/urlResolver');
const { parseChatMessage } = require('./parsers/chatParser');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift
} = require('./parsers/giftParser');
const {
  parseInitialStreamInfo,
  parseUpdatedMetadataActions
} = require('./parsers/metadataParser');

class YouTubeLiveConnector extends EventEmitter {
  /**
   * @param {object|string} [options] Connection options or YouTube URL / Video ID
   * @param {string} [options.url] YouTube Live stream URL or Video ID
   * @param {string} [options.liveId] YouTube Video ID (alias)
   * @param {string} [options.channel] Channel URL or handle e.g. @ChannelName
   * @param {boolean} [options.pollViewers=true] Enable continuous polling of live viewer count
   * @param {number} [options.viewerIntervalMs=5000] Interval for polling live viewers (default 5000ms)
   * @param {number} [options.chatIntervalMs] Override chat polling interval (defaults to YouTube recommendation)
   * @param {boolean} [options.ignoreInitialChat=false] Skip emitting chat items present on initial page load
   * @param {object} [options.headers] Custom HTTP headers
   */
  constructor(options = {}) {
    super();

    if (typeof options === 'string') {
      options = { url: options };
    }

    this.initialUrl = options.url || options.liveId || options.channel || null;
    this.pollViewersEnabled = options.pollViewers !== false;
    this.viewerIntervalMs = options.viewerIntervalMs || 5000;
    this.chatIntervalOverride = options.chatIntervalMs || null;
    this.ignoreInitialChat = options.ignoreInitialChat === true;

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
  }

  /**
   * Connect to YouTube Live
   * @param {string} [url] Optional YouTube Live URL or Video ID
   * @returns {Promise<object>} Returns streamInfo
   */
  async connect(url) {
    if (this.connected) {
      throw new Error('Connector is already connected. Call disconnect() first.');
    }

    const targetUrl = url || this.initialUrl;
    if (!targetUrl) {
      throw new Error('No YouTube URL or Video ID provided.');
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

      // 3. Fetch live_chat page to obtain initial chat continuation token
      const chatPage = await this.innertube.fetchLiveChatPage(this.videoId);
      this.chatContinuation = chatPage.continuation;

      this.connected = true;

      // Emit connected event
      this.emit('connected', { ...this.streamInfo });

      // If initial viewer count was discovered, emit viewers event
      if (this.streamInfo.viewerCount > 0) {
        this._emitViewerCount(this.streamInfo.viewerCount, this.streamInfo.viewerCountDisplay);
      }

      // If chat is disabled, warn user
      if (chatPage.isDisabled) {
        this.emit('warning', {
          type: 'chat_disabled',
          message: 'Live chat is disabled for this stream.'
        });
      }

      // Process initial chat messages if present (unless ignoreInitialChat is true)
      if (chatPage.liveChatRenderer?.actions && !this.ignoreInitialChat) {
        this._processActions(chatPage.liveChatRenderer.actions);
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

      if (res.actions && res.actions.length > 0) {
        this._processActions(res.actions);
      }

      if (res.nextContinuation) {
        this.chatContinuation = res.nextContinuation;
        const nextDelay = this.chatIntervalOverride || res.timeoutMs || 2000;
        this._scheduleChatPoll(nextDelay);
      } else {
        // Stream chat might have ended
        this.emit('chatEnded', { videoId: this.videoId });
      }
    } catch (err) {
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
   * Poll viewer count via updated_metadata endpoint
   * @private
   */
  async _pollViewers() {
    if (!this.connected || !this.pollViewersEnabled) return;

    try {
      const res = await this.innertube.fetchUpdatedMetadata(this.videoId, this.metadataContinuation);

      if (res.actions && res.actions.length > 0) {
        const updates = parseUpdatedMetadataActions(res.actions);

        if (updates.viewerCount !== undefined) {
          this.streamInfo.viewerCount = updates.viewerCount;
          this.streamInfo.viewerCountDisplay = updates.viewerCountDisplay;
          this._emitViewerCount(updates.viewerCount, updates.viewerCountDisplay);
        }

        if (updates.title && updates.title !== this.streamInfo.title) {
          this.streamInfo.title = updates.title;
          this.emit('title', { title: updates.title });
        }

        if (updates.likeCount) {
          this.streamInfo.likeCount = updates.likeCount;
          this.emit('like', { likeCount: updates.likeCount });
        }

        if (updates.isLive === false && this.streamInfo.isLive === true) {
          this.streamInfo.isLive = false;
          this.emit('streamEnded', { videoId: this.videoId });
        }
      }

      if (res.nextContinuation) {
        this.metadataContinuation = res.nextContinuation;
      }

      const nextDelay = res.timeoutMs || this.viewerIntervalMs;
      this._scheduleViewerPoll(nextDelay);
    } catch (err) {
      // Don't kill entire connector if only viewer poll fails once
      this._scheduleViewerPoll(this.viewerIntervalMs * 2);
    }
  }

  /**
   * Emit viewer count and tiktok-like roomUser event
   * @private
   */
  _emitViewerCount(viewerCount, viewerCountDisplay) {
    const data = {
      viewerCount,
      viewerCountDisplay,
      timestamp: new Date()
    };
    this.emit('viewers', data);
    // Alias event for 100% familiarity with tiktok-live-connector
    this.emit('roomUser', data);
  }

  /**
   * Process and dispatch chat actions
   * @private
   */
  _processActions(actions) {
    for (const action of actions) {
      this.emit('raw', action);

      const item = action.addChatItemAction?.item ||
                   action.addLiveChatTickerItemAction?.item ||
                   action.addLiveChatItemToGroupAction?.item;
      if (!item) continue;

      // 1. YouTube Jewels Gift (giftMessageViewModel) - Interactive TikTok-style gifts
      if (item.giftMessageViewModel) {
        const jewelsData = parseJewelsGift(item.giftMessageViewModel);
        if (jewelsData && !this._isDuplicate(jewelsData.id)) {
          // Emit unified gift event (so TikTok Live Connector users receive it)
          this.emit('gift', jewelsData);
          // Emit specific jewelsGift event
          this.emit('jewelsGift', jewelsData);
        }
        continue;
      }

      // 2. Standard text chat
      if (item.liveChatTextMessageRenderer) {
        const chatData = parseChatMessage(item.liveChatTextMessageRenderer);
        if (chatData && !this._isDuplicate(chatData.id)) {
          this.emit('chat', chatData);
        }
        continue;
      }

      // 2. Super Chat
      if (item.liveChatPaidMessageRenderer) {
        const superChatData = parseSuperChat(item.liveChatPaidMessageRenderer);
        if (superChatData && !this._isDuplicate(superChatData.id)) {
          // Emit unified gift event
          this.emit('gift', superChatData);
          // Emit specific superchat event
          this.emit('superchat', superChatData);
        }
        continue;
      }

      // 3. Super Sticker
      if (item.liveChatPaidStickerRenderer) {
        const stickerData = parseSuperSticker(item.liveChatPaidStickerRenderer);
        if (stickerData && !this._isDuplicate(stickerData.id)) {
          // Emit unified gift event
          this.emit('gift', stickerData);
          // Emit specific supersticker event
          this.emit('supersticker', stickerData);
        }
        continue;
      }

      // 4. Membership Joined / Milestone
      if (item.liveChatMembershipItemRenderer) {
        const memberData = parseMembership(item.liveChatMembershipItemRenderer);
        if (memberData && !this._isDuplicate(memberData.id)) {
          // Emit unified gift event
          this.emit('gift', memberData);
          // Emit specific member event
          this.emit('member', memberData);
        }
        continue;
      }

      // 5. Gift Memberships (Someone gifts memberships to others)
      if (item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
        const giftData = parseGiftMemberships(item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer);
        if (giftData && !this._isDuplicate(giftData.id)) {
          // Emit unified gift event
          this.emit('gift', giftData);
          // Emit specific memberGift event
          this.emit('memberGift', giftData);
        }
        continue;
      }

      // 6. Viewer Engagement (e.g. pinned message, polls)
      if (action.showLiveChatActionPanelAction) {
        this.emit('actionPanel', action.showLiveChatActionPanelAction);
      }
    }
  }

  /**
   * Check if message ID has already been emitted
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
