'use strict';

const EventEmitter = require('events');
const InnertubeService = require('./services/innertubeService');
const { resolveVideoId } = require('./services/urlResolver');
const { parseChatMessage, parseViewerEngagementMessage } = require('./parsers/chatParser');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift,
  parseGiftRedemption
} = require('./parsers/giftParser');
const {
  parseInitialStreamInfo,
  parseUpdatedMetadataActions
} = require('./parsers/metadataParser');
const { parseEmojiReactions } = require('./parsers/reactionParser');

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

    // Last seen states for likes & emoji reactions
    this.lastLikeCount = null;
    this.lastReactionUpdateTimeUsec = null;

    // Deduplication set for processed message IDs
    this.processedMessageIds = new Set();
    this.maxCachedMessageIds = 10000;

    // Stream-ended detection: count consecutive chat polls with no continuation
    this.chatEndRetries = 0;
    this.maxChatEndRetries = 3;
    this._hasEnded = false;
  }

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
      if (this.streamInfo.likeCount !== undefined && this.streamInfo.likeCount !== null) {
        this.lastLikeCount = this.streamInfo.likeCount;
      }

      // 3. Fetch live_chat page to obtain initial chat continuation token
      const chatPage = await this.innertube.fetchLiveChatPage(this.videoId);
      this.chatContinuation = chatPage.continuation;

      this.connected = true;
      this._hasEnded = false;
      this.chatEndRetries = 0;

      // Emit connected event
      this.emit('connected', { ...this.streamInfo });

      // If initial viewer count was discovered, emit viewers event
      if (this.streamInfo.viewerCount > 0) {
        this._emitViewerCount(this.streamInfo.viewerCount, this.streamInfo.viewerCountDisplay);
      }

      // If initial like count was discovered, emit like event
      if (this.streamInfo.likeCount > 0 || this.streamInfo.likeCountDisplay) {
        this.emit('like', {
          likeCount: this.streamInfo.likeCount,
          likeCountDisplay: this.streamInfo.likeCountDisplay || String(this.streamInfo.likeCount),
          likesIncrement: 0,
          timestamp: new Date()
        });
      }

      // If chat is disabled, warn user
      if (chatPage.isDisabled) {
        this.emit('warning', {
          type: 'chat_disabled',
          message: 'Live chat is disabled for this stream.'
        });
      }

      // Process initial reactions if present (unless ignoreInitialChat is true)
      if (chatPage.frameworkUpdates?.entityBatchUpdate?.mutations && !this.ignoreInitialChat) {
        this._processReactions(chatPage.frameworkUpdates.entityBatchUpdate.mutations);
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

      // Process emoji reactions (floating emoji fountain: ❤️, 😄, 🎉, 😳, 💯)
      if (res.frameworkUpdates?.entityBatchUpdate?.mutations) {
        this._processReactions(res.frameworkUpdates.entityBatchUpdate.mutations);
      }

      if (res.actions && res.actions.length > 0) {
        this._processActions(res.actions);
      }

      if (res.nextContinuation) {
        // Got a valid continuation — stream is still live, reset the end-retry counter
        this.chatEndRetries = 0;
        this.chatContinuation = res.nextContinuation;
        const nextDelay = this.chatIntervalOverride || res.timeoutMs || 2000;
        this._scheduleChatPoll(nextDelay);
      } else {
        // No continuation returned — YouTube stops providing one when the stream ends.
        // Retry a few times to rule out transient hiccups before declaring the stream ended.
        this.chatEndRetries++;
        this.emit('chatEnded', { videoId: this.videoId, retryCount: this.chatEndRetries });

        if (this.chatEndRetries >= this.maxChatEndRetries) {
          // Confirmed: stream has ended
          this._handleStreamEnded('Chat continuation exhausted');
        } else {
          // Wait longer before retrying to avoid hammering YouTube
          this._scheduleChatPoll(5000);
        }
      }
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404')) {
        this._handleStreamEnded('Video not found or stream removed');
        return;
      }
      this.emit('error', err);
      // Retry chat polling with fallback delay
      this._scheduleChatPoll(4000);
    }
  }

  /**
   * Process and dispatch emoji fountain reactions
   * @private
   */
  _processReactions(mutations) {
    const batches = parseEmojiReactions(mutations);
    for (const batch of batches) {
      if (batch.updateTimeUsec && batch.updateTimeUsec === this.lastReactionUpdateTimeUsec) {
        continue;
      }
      if (batch.updateTimeUsec) {
        this.lastReactionUpdateTimeUsec = batch.updateTimeUsec;
      }

      // Emit batch reactions event
      this.emit('reactions', batch);

      // Emit individual reaction event for each emoji
      for (const r of batch.reactions) {
        this.emit('reaction', {
          emoji: r.emoji,
          count: r.count,
          totalReactions: batch.totalReactions,
          intensityScore: batch.intensityScore,
          updateTimeUsec: batch.updateTimeUsec,
          timestamp: batch.timestamp,
          raw: batch.raw
        });
      }
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

        if (updates.likeCountDisplay || updates.likeCount !== undefined) {
          const currentLikeCount = updates.likeCount !== undefined ? updates.likeCount : 0;
          const display = updates.likeCountDisplay || String(currentLikeCount);
          const increment = this.lastLikeCount !== null ? Math.max(0, currentLikeCount - this.lastLikeCount) : 0;

          this.streamInfo.likeCount = currentLikeCount;
          this.streamInfo.likeCountDisplay = display;

          if (this.lastLikeCount === null || currentLikeCount !== this.lastLikeCount) {
            this.lastLikeCount = currentLikeCount;
            this.emit('like', {
              likeCount: currentLikeCount,
              likeCountDisplay: display,
              likesIncrement: increment,
              timestamp: new Date()
            });
          }
        }

        if (updates.isLive === false) {
          this._handleStreamEnded('Live stream has ended');
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
        this._handleStreamEnded('Video not found or stream removed');
        return;
      }
      // Don't kill entire connector if only viewer poll fails once
      this._scheduleViewerPoll(this.viewerIntervalMs * 2);
    }
  }

  /**
   * Emit viewer count and roomUser event
   * @private
   */
  _emitViewerCount(viewerCount, viewerCountDisplay) {
    const data = {
      viewerCount,
      viewerCountDisplay,
      timestamp: new Date()
    };
    this.emit('viewers', data);
    // Alias event for room viewers
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

      // 1. YouTube Jewels Gift (giftMessageViewModel) - Interactive live gifts
      if (item.giftMessageViewModel) {
        const jewelsData = parseJewelsGift(item.giftMessageViewModel);
        if (jewelsData && !this._isDuplicate(jewelsData.id)) {
          // Emit unified gift event
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
          // Emit subscribe and follow event (membership subscription)
          this.emit('subscribe', {
            ...memberData,
            isMembership: true,
            subType: 'membership'
          });
          this.emit('follow', {
            ...memberData,
            isMembership: true,
            subType: 'membership'
          });
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

      // 6. Gift Membership Redeemed (Someone received a gifted membership)
      if (item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
        const redeemData = parseGiftRedemption(item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer);
        if (redeemData && !this._isDuplicate(redeemData.id)) {
          // Emit unified gift event
          this.emit('gift', redeemData);
          // Emit specific memberRedeem event
          this.emit('memberRedeem', redeemData);
        }
        continue;
      }

      // 7. Viewer Engagement Message (e.g. system notices, subscriber notices)
      if (item.liveChatViewerEngagementMessageRenderer) {
        const engagementData = parseViewerEngagementMessage(item.liveChatViewerEngagementMessageRenderer);
        if (engagementData && !this._isDuplicate(engagementData.id)) {
          this.emit('engagement', engagementData);
          if (engagementData.isSubscribeNotice) {
            this.emit('subscribe', {
              id: engagementData.id,
              message: engagementData.message,
              isMembership: false,
              subType: 'engagement_notice',
              timestamp: engagementData.timestamp,
              raw: engagementData.raw
            });
            this.emit('follow', {
              id: engagementData.id,
              message: engagementData.message,
              isMembership: false,
              subType: 'engagement_notice',
              timestamp: engagementData.timestamp,
              raw: engagementData.raw
            });
          }
        }
        continue;
      }

      // 8. Viewer Engagement Action Panel (e.g. pinned message, polls)
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
   * Handle stream ended event and trigger optional auto-disconnect
   * @private
   * @param {string} [reason='Stream ended']
   */
  _handleStreamEnded(reason = 'Stream ended') {
    if (this._hasEnded) return;
    this._hasEnded = true;

    if (this.streamInfo) {
      this.streamInfo.isLive = false;
    }

    if (this.chatTimer) {
      clearTimeout(this.chatTimer);
      this.chatTimer = null;
    }
    if (this.viewerTimer) {
      clearTimeout(this.viewerTimer);
      this.viewerTimer = null;
    }

    this.emit('streamEnded', {
      videoId: this.videoId,
      reason
    });

    if (this.autoDisconnectOnEnd) {
      this.disconnect(reason);
    }
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
    this.lastReactionUpdateTimeUsec = null;
    this.lastLikeCount = null;
    this.chatEndRetries = 0;

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
