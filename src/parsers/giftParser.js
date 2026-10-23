'use strict';

const {
  extractRunText,
  parsePrice,
  getLastThumbnail,
  parseTimestamp,
  toHexColor,
  parseAuthor
} = require('../utils/helpers');

/**
 * Parse a Super Chat (liveChatPaidMessageRenderer)
 * @param {object} renderer 
 * @returns {object|null}
 */
function parseSuperChat(renderer) {
  if (!renderer) return null;

  const rawAmount = renderer.purchaseAmountText?.simpleText || '';
  const { amount, currency } = parsePrice(rawAmount);
  const { text: message, emojis } = extractRunText(renderer.message);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);

  return {
    type: 'superchat',
    id: renderer.id || '',
    author: parseAuthor(renderer),
    amount,
    currency,
    amountDisplay: rawAmount,
    message,
    emojis,
    colors: {
      headerBackgroundColor: toHexColor(renderer.headerBackgroundColor),
      headerTextColor: toHexColor(renderer.headerTextColor),
      bodyBackgroundColor: toHexColor(renderer.bodyBackgroundColor),
      bodyTextColor: toHexColor(renderer.bodyTextColor)
    },
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse a Super Sticker (liveChatPaidStickerRenderer)
 * @param {object} renderer 
 * @returns {object|null}
 */
function parseSuperSticker(renderer) {
  if (!renderer) return null;

  const rawAmount = renderer.purchaseAmountText?.simpleText || '';
  const { amount, currency } = parsePrice(rawAmount);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);

  return {
    type: 'supersticker',
    id: renderer.id || '',
    author: parseAuthor(renderer),
    amount,
    currency,
    amountDisplay: rawAmount,
    sticker: {
      url: getLastThumbnail(renderer.sticker?.thumbnails),
      alt: renderer.sticker?.accessibility?.accessibilityData?.label || ''
    },
    backgroundColor: toHexColor(renderer.backgroundColor),
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse Channel Membership Join / Renewal / Milestone (liveChatMembershipItemRenderer)
 * @param {object} renderer 
 * @returns {object|null}
 */
function parseMembership(renderer) {
  if (!renderer) return null;

  const { text: headerSubtext } = extractRunText(renderer.headerSubtext);
  const { text: headerPrimaryText } = extractRunText(renderer.headerPrimaryText);
  const { text: message, emojis } = extractRunText(renderer.message);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);

  return {
    type: 'membership',
    id: renderer.id || '',
    author: parseAuthor(renderer, true),
    headerText: headerPrimaryText || headerSubtext,
    subtext: headerSubtext,
    message,
    emojis,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse Gift Memberships Purchased (liveChatSponsorshipsGiftPurchaseAnnouncementRenderer)
 * @param {object} renderer 
 * @returns {object|null}
 */
function parseGiftMemberships(renderer) {
  if (!renderer) return null;

  const header = renderer.header?.liveChatSponsorshipsHeaderRenderer;
  const { text: headerText } = extractRunText(header?.primaryText);
  const countMatch = headerText.match(/(\d+)/);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);

  return {
    type: 'membership_gift',
    id: renderer.id || '',
    author: {
      ...parseAuthor(header, true),
      channelId: ''
    },
    giftCount: countMatch ? parseInt(countMatch[1], 10) : 1,
    headerText,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse YouTube Jewels Gift (giftMessageViewModel)
 * @param {object} viewModel 
 * @returns {object|null}
 */
function parseJewelsGift(viewModel) {
  if (!viewModel) return null;

  const authorName = viewModel.authorName?.content?.trim() || '';
  const profilePictureUrl = getLastThumbnail(viewModel.authorAvatar?.avatarViewModel?.image?.sources);

  let giftImageUrl = getLastThumbnail(viewModel.giftImage?.sources);
  if (giftImageUrl.startsWith('//')) giftImageUrl = `https:${giftImageUrl}`;

  const actionText = viewModel.text?.content || '';
  let giftName = actionText ? actionText.replace(/^sent\s+/i, '').trim() : '';
  if (!giftName && viewModel.giftImageA11yLabel) {
    const parts = viewModel.giftImageA11yLabel.split(',');
    giftName = parts[parts.length - 1].trim();
  }

  const { timestamp, timestampUsec } = parseTimestamp(null);

  return {
    type: 'jewels_gift',
    id: viewModel.id || '',
    author: {
      name: authorName,
      channelId: '',
      profilePictureUrl,
      isOwner: false,
      isModerator: false,
      isMember: false,
      isVerified: false,
      badges: []
    },
    giftName,
    actionText,
    giftImage: {
      url: giftImageUrl,
      alt: viewModel.giftImageA11yLabel || giftName
    },
    timestamp,
    timestampUsec,
    raw: viewModel
  };
}

/**
 * Parse Gift Membership Redemption (liveChatSponsorshipsGiftRedemptionAnnouncementRenderer)
 * @param {object} renderer
 * @returns {object|null}
 */
function parseGiftRedemption(renderer) {
  if (!renderer) return null;

  const { text: message } = extractRunText(renderer.message);
  const gifterMatch = message.match(/by\s+(.+)$/i);
  const { timestamp, timestampUsec } = parseTimestamp(renderer.timestampUsec);

  return {
    type: 'membership_redeem',
    id: renderer.id || '',
    author: {
      ...parseAuthor(renderer, true),
      channelId: ''
    },
    gifterName: gifterMatch ? gifterMatch[1].trim() : '',
    message,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

module.exports = {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift,
  parseGiftRedemption
};
