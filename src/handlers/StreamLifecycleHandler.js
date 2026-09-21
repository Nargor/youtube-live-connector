'use strict';

const BaseHandler = require('./BaseHandler');

/**
 * StreamLifecycleHandler
 * Handles stream lifecycle events:
 * - Title changes (event: 'title')
 * - Chat continuation exhaustion (event: 'chatEnded')
 * - Stream ended detection (event: 'streamEnded')
 * - Automatic disconnect coordination (event: 'disconnected')
 */
class StreamLifecycleHandler extends BaseHandler {
  constructor(connector) {
    super(connector);
    this.hasEnded = false;
    this.chatEndRetries = 0;
    this.maxChatEndRetries = 3;
  }

  /**
   * Handle metadata updates for title and stream active state
   * @param {object} updates
   * @param {object} context
   */
  handleMetadata(updates, context = {}) {
    // 1. Title change
    if (updates.title && this.connector.streamInfo && updates.title !== this.connector.streamInfo.title) {
      this.connector.streamInfo.title = updates.title;
      this.emit('title', { title: updates.title });
    }

    // 2. Stream ended via metadata isLive: false (or updateDateTextAction)
    if (updates.isLive === false) {
      this.handleStreamEnded('Live stream has ended');
    }
  }

  /**
   * Handle chat continuation result from polling
   * @param {string|null} nextContinuation
   * @returns {boolean} True if continuation was valid, false if ended
   */
  handleChatContinuation(nextContinuation) {
    if (nextContinuation) {
      // Valid continuation — stream chat is healthy, reset retry counter
      this.chatEndRetries = 0;
      return true;
    }

    // No continuation returned — increment retry counter and emit chatEnded
    this.chatEndRetries++;
    this.emit('chatEnded', {
      videoId: this.connector.videoId,
      retryCount: this.chatEndRetries
    });

    if (this.chatEndRetries >= this.maxChatEndRetries) {
      this.handleStreamEnded('Chat continuation exhausted');
    }

    return false;
  }

  /**
   * Trigger stream ended event and optional auto-disconnect
   * @param {string} [reason='Stream ended']
   */
  handleStreamEnded(reason = 'Stream ended') {
    if (this.hasEnded) return;
    this.hasEnded = true;

    if (this.connector.streamInfo) {
      this.connector.streamInfo.isLive = false;
    }

    // Stop active timers immediately
    if (this.connector.chatTimer) {
      clearTimeout(this.connector.chatTimer);
      this.connector.chatTimer = null;
    }
    if (this.connector.viewerTimer) {
      clearTimeout(this.connector.viewerTimer);
      this.connector.viewerTimer = null;
    }

    this.emit('streamEnded', {
      videoId: this.connector.videoId,
      reason
    });

    if (this.connector.autoDisconnectOnEnd) {
      this.connector.disconnect(reason);
    }
  }

  /**
   * Reset lifecycle state
   */
  reset() {
    this.hasEnded = false;
    this.chatEndRetries = 0;
  }
}

module.exports = StreamLifecycleHandler;
