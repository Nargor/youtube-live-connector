'use strict';

const { extractRunText, parseBadges } = require('../utils/helpers');

/**
 * Parse a standard live chat message action (liveChatTextMessageRenderer)
 * @param {object} renderer 
 * @returns {object}
 */
function parseChatMessage(renderer) {
  if (!renderer) return null;

  const id = renderer.id || '';
  const authorName = renderer.authorName?.simpleText || '';
  const authorChannelId = renderer.authorExternalChannelId || '';
  
  // Highest resolution author thumbnail
  const thumbnails = renderer.authorPhoto?.thumbnails || [];
  const profilePictureUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';

  // Badges (moderator, member, verified, owner)
  const badgeInfo = parseBadges(renderer.authorBadges);

  // Message text and emojis
  const { text: message, emojis } = extractRunText(renderer.message);

  // Timestamp
  const timestampUsec = renderer.timestampUsec ? parseInt(renderer.timestampUsec, 10) : Date.now() * 1000;
  const timestamp = new Date(Math.floor(timestampUsec / 1000));

  return {
    id,
    author: {
      name: authorName,
      channelId: authorChannelId,
      profilePictureUrl,
      isOwner: badgeInfo.isOwner,
      isModerator: badgeInfo.isModerator,
      isMember: badgeInfo.isMember,
      isVerified: badgeInfo.isVerified,
      badges: badgeInfo.badges
    },
    message,
    messageRuns: renderer.message?.runs || [],
    emojis,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

module.exports = {
  parseChatMessage
};
