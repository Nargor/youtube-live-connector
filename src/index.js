'use strict';

const YouTubeLiveConnector = require('./YouTubeLiveConnector');
const { resolveVideoId, extractVideoIdSync } = require('./services/urlResolver');
const { parseChatMessage, parseViewerEngagementMessage } = require('./parsers/chatParser');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift,
  parseGiftRedemption
} = require('./parsers/giftParser');
const { parseInitialStreamInfo, parseUpdatedMetadataActions } = require('./parsers/metadataParser');
const { parseEmojiReactions } = require('./parsers/reactionParser');
const { parseViewerCount, parsePrice, parseBadges, extractRunText } = require('./utils/helpers');

// Support both `const YouTubeLiveConnector = require('...')`
// AND `const { YouTubeLiveConnector } = require('...')`
YouTubeLiveConnector.YouTubeLiveConnector = YouTubeLiveConnector;
YouTubeLiveConnector.default = YouTubeLiveConnector;

// Export utility functions and parsers on the main export
YouTubeLiveConnector.resolveVideoId = resolveVideoId;
YouTubeLiveConnector.extractVideoIdSync = extractVideoIdSync;
YouTubeLiveConnector.parseChatMessage = parseChatMessage;
YouTubeLiveConnector.parseViewerEngagementMessage = parseViewerEngagementMessage;
YouTubeLiveConnector.parseEmojiReactions = parseEmojiReactions;
YouTubeLiveConnector.parseSuperChat = parseSuperChat;
YouTubeLiveConnector.parseSuperSticker = parseSuperSticker;
YouTubeLiveConnector.parseMembership = parseMembership;
YouTubeLiveConnector.parseGiftMemberships = parseGiftMemberships;
YouTubeLiveConnector.parseJewelsGift = parseJewelsGift;
YouTubeLiveConnector.parseGiftRedemption = parseGiftRedemption;
YouTubeLiveConnector.parseInitialStreamInfo = parseInitialStreamInfo;
YouTubeLiveConnector.parseUpdatedMetadataActions = parseUpdatedMetadataActions;
YouTubeLiveConnector.parseViewerCount = parseViewerCount;
YouTubeLiveConnector.parsePrice = parsePrice;
YouTubeLiveConnector.parseBadges = parseBadges;
YouTubeLiveConnector.extractRunText = extractRunText;

module.exports = YouTubeLiveConnector;
