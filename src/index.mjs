import YouTubeLiveConnector from './YouTubeLiveConnector.js';
import { resolveVideoId, extractVideoIdSync } from './services/urlResolver.js';
import { parseChatMessage, parseViewerEngagementMessage } from './parsers/chatParser.js';
import {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift,
  parseGiftRedemption
} from './parsers/giftParser.js';
import { parseInitialStreamInfo, parseUpdatedMetadataActions } from './parsers/metadataParser.js';
import { parseEmojiReactions } from './parsers/reactionParser.js';
import { parseViewerCount, parsePrice, parseBadges, extractRunText } from './utils/helpers.js';

import {
  BaseHandler,
  ChatHandler,
  GiftHandler,
  LikeHandler,
  ReactionHandler,
  ViewerHandler,
  EngagementHandler,
  StreamLifecycleHandler,
  ActionPanelHandler,
  HandlerRegistry
} from './handlers/index.js';

export {
  YouTubeLiveConnector,
  resolveVideoId,
  extractVideoIdSync,
  parseChatMessage,
  parseViewerEngagementMessage,
  parseEmojiReactions,
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift,
  parseGiftRedemption,
  parseInitialStreamInfo,
  parseUpdatedMetadataActions,
  parseViewerCount,
  parsePrice,
  parseBadges,
  extractRunText,
  BaseHandler,
  ChatHandler,
  GiftHandler,
  LikeHandler,
  ReactionHandler,
  ViewerHandler,
  EngagementHandler,
  StreamLifecycleHandler,
  ActionPanelHandler,
  HandlerRegistry
};

export default YouTubeLiveConnector;
