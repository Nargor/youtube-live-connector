'use strict';

const YouTubeLiveConnector = require('./YouTubeLiveConnector');
const { resolveVideoId, extractVideoIdSync } = require('./services/urlResolver');
const { parseChatMessage } = require('./parsers/chatParser');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships
} = require('./parsers/giftParser');
const { parseInitialStreamInfo, parseUpdatedMetadataActions } = require('./parsers/metadataParser');
const { parseViewerCount, parsePrice } = require('./utils/helpers');

module.exports = {
  YouTubeLiveConnector,
  // Helper / Resolver exports
  resolveVideoId,
  extractVideoIdSync,
  // Parsers
  parseChatMessage,
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseInitialStreamInfo,
  parseUpdatedMetadataActions,
  parseViewerCount,
  parsePrice
};
