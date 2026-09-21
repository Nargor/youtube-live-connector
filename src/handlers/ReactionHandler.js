'use strict';

const BaseHandler = require('./BaseHandler');
const { parseEmojiReactions } = require('../parsers/reactionParser');

/**
 * ReactionHandler
 * Handles floating emoji reactions / emoji fountain (events: 'reaction', 'reactions')
 */
class ReactionHandler extends BaseHandler {
  constructor(connector) {
    super(connector);
    this.lastReactionUpdateTimeUsec = null;
  }

  /**
   * Process framework mutations (emojiFountainDataEntity)
   * @param {Array} mutations
   * @param {object} context
   */
  handleFrameworkUpdate(mutations, context = {}) {
    if (!Array.isArray(mutations) || mutations.length === 0) return;

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
   * Reset reaction update time cache
   */
  reset() {
    this.lastReactionUpdateTimeUsec = null;
  }
}

module.exports = ReactionHandler;
