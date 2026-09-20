'use strict';

/**
 * Parse YouTube Live emoji fountain reactions from frameworkUpdates mutations
 * These are the floating reactions (❤️, 😄, 🎉, 😳, 💯) tapped by viewers on the live stream.
 * 
 * @param {Array} mutations - Array of mutations from frameworkUpdates.entityBatchUpdate.mutations
 * @returns {Array<object>} Array of parsed reaction batch objects
 */
function parseEmojiReactions(mutations) {
  if (!Array.isArray(mutations)) return [];

  const results = [];

  for (const mutation of mutations) {
    const entity = mutation.payload?.emojiFountainDataEntity;
    if (!entity) continue;

    const key = entity.key || mutation.entityKey || '';
    const updateTimeUsec = entity.updateTimeUsec ? String(entity.updateTimeUsec) : '';
    const reactionBuckets = Array.isArray(entity.reactionBuckets) ? entity.reactionBuckets : [];

    for (const bucket of reactionBuckets) {
      const reactionsData = Array.isArray(bucket.reactionsData) ? bucket.reactionsData : [];
      const reactions = reactionsData.map(r => ({
        emoji: r.unicodeEmojiId || '',
        count: typeof r.reactionCount === 'number' ? r.reactionCount : parseInt(r.reactionCount, 10) || 1
      })).filter(r => r.emoji.length > 0);

      const calculatedTotal = reactions.reduce((acc, r) => acc + r.count, 0);
      const totalReactions = typeof bucket.totalReactions === 'number' 
        ? bucket.totalReactions 
        : (parseInt(bucket.totalReactions, 10) || calculatedTotal);

      const intensityScore = typeof bucket.intensityScore === 'number'
        ? bucket.intensityScore
        : (parseFloat(bucket.intensityScore) || 0);

      const durationSeconds = bucket.duration?.seconds 
        ? parseInt(bucket.duration.seconds, 10) 
        : 1;

      // Convert updateTimeUsec to Date if valid
      let timestamp = new Date();
      if (updateTimeUsec) {
        const ms = Math.floor(parseInt(updateTimeUsec, 10) / 1000);
        if (!isNaN(ms) && ms > 0) {
          timestamp = new Date(ms);
        }
      }

      results.push({
        key,
        updateTimeUsec,
        totalReactions,
        intensityScore,
        durationSeconds,
        reactions,
        timestamp,
        raw: entity
      });
    }
  }

  return results;
}

module.exports = {
  parseEmojiReactions
};
