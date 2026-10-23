'use strict';

const { extractRunText, parseAuthor, parseTimestamp } = require('../utils/helpers');

/**
 * Parse a standard live chat message action (liveChatTextMessageRenderer)
 * @param {object} renderer 
 * @returns {object|null}
 */
function parseChatMessage(renderer) {
  if (!renderer) return null;

  const { text: message, emojis } = extractRunText(renderer.message);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);

  return {
    id: renderer.id || '',
    author: parseAuthor(renderer),
    message,
    messageRuns: renderer.message?.runs || [],
    emojis,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse viewer engagement message (liveChatViewerEngagementMessageRenderer)
 * e.g., pinned announcements, system notices, subscriber notices
 * @param {object} renderer 
 * @returns {object|null}
 */
function parseViewerEngagementMessage(renderer) {
  if (!renderer) return null;

  const { text: message } = extractRunText(renderer.message);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);
  const actionButtonText = renderer.actionButton?.buttonRenderer?.text?.simpleText || 
    extractRunText(renderer.actionButton?.buttonRenderer?.text).text;

  const lower = message.toLowerCase();
  const isSubscribeNotice = lower.includes('subscri') || lower.includes('follow') || lower.includes('ติดตาม');

  return {
    id: renderer.id || '',
    message,
    iconType: renderer.icon?.iconType || '',
    actionButtonText,
    isSubscribeNotice,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

module.exports = {
  parseChatMessage,
  parseViewerEngagementMessage
};
