'use strict';

const YouTubeLiveConnector = require('./YouTubeLiveConnector');
const urlResolver = require('./services/urlResolver');
const chatParser = require('./parsers/chatParser');
const giftParser = require('./parsers/giftParser');
const metadataParser = require('./parsers/metadataParser');
const reactionParser = require('./parsers/reactionParser');
const helpers = require('./utils/helpers');
const handlers = require('./handlers');

Object.assign(YouTubeLiveConnector, {
  YouTubeLiveConnector,
  default: YouTubeLiveConnector,
  ...urlResolver,
  ...chatParser,
  ...giftParser,
  ...metadataParser,
  ...reactionParser,
  ...helpers,
  ...handlers
});

module.exports = YouTubeLiveConnector;
