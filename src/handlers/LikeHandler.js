'use strict';

const BaseHandler = require('./BaseHandler');

/**
 * LikeHandler
 * Handles live stream likes and increment tracking (event: 'like')
 */
class LikeHandler extends BaseHandler {
  constructor(connector) {
    super(connector);
    this.lastLikeCount = null;
  }

  /**
   * Initialize like count from watch page initial data
   * @param {number} likeCount
   * @param {string} likeCountDisplay
   */
  initialize(likeCount, likeCountDisplay) {
    if (likeCount !== undefined && likeCount !== null) {
      this.lastLikeCount = likeCount;
    }

    if (likeCount > 0 || likeCountDisplay) {
      this.emit('like', {
        likeCount: likeCount || 0,
        likeCountDisplay: likeCountDisplay || String(likeCount || 0),
        likesIncrement: 0,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle metadata updates from updated_metadata polling
   * @param {object} updates
   * @param {object} context
   */
  handleMetadata(updates, context = {}) {
    if (updates.likeCountDisplay || updates.likeCount !== undefined) {
      const currentLikeCount = updates.likeCount !== undefined ? updates.likeCount : 0;
      const display = updates.likeCountDisplay || String(currentLikeCount);
      const increment = this.lastLikeCount !== null ? Math.max(0, currentLikeCount - this.lastLikeCount) : 0;

      if (this.connector.streamInfo) {
        this.connector.streamInfo.likeCount = currentLikeCount;
        this.connector.streamInfo.likeCountDisplay = display;
      }

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
  }

  /**
   * Reset internal like count state
   */
  reset() {
    this.lastLikeCount = null;
  }
}

module.exports = LikeHandler;
