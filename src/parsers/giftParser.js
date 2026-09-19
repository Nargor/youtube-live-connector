'use strict';

const { extractRunText, parsePrice, parseBadges } = require('../utils/helpers');

/**
 * Parse a Super Chat (liveChatPaidMessageRenderer)
 * @param {object} renderer 
 * @returns {object}
 */
function parseSuperChat(renderer) {
  if (!renderer) return null;

  const id = renderer.id || '';
  const authorName = renderer.authorName?.simpleText || '';
  const authorChannelId = renderer.authorExternalChannelId || '';
  const thumbnails = renderer.authorPhoto?.thumbnails || [];
  const profilePictureUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
  const badgeInfo = parseBadges(renderer.authorBadges);

  const rawAmount = renderer.purchaseAmountText?.simpleText || '';
  const { amount, currency } = parsePrice(rawAmount);

  const { text: message, emojis } = extractRunText(renderer.message);

  const timestampUsec = renderer.timestampUsec ? parseInt(renderer.timestampUsec, 10) : Date.now() * 1000;
  const timestamp = new Date(Math.floor(timestampUsec / 1000));

  return {
    type: 'superchat',
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
    amount,
    currency,
    amountDisplay: rawAmount,
    message,
    emojis,
    colors: {
      headerBackgroundColor: renderer.headerBackgroundColor ? `#${renderer.headerBackgroundColor.toString(16).padStart(6, '0')}` : null,
      headerTextColor: renderer.headerTextColor ? `#${renderer.headerTextColor.toString(16).padStart(6, '0')}` : null,
      bodyBackgroundColor: renderer.bodyBackgroundColor ? `#${renderer.bodyBackgroundColor.toString(16).padStart(6, '0')}` : null,
      bodyTextColor: renderer.bodyTextColor ? `#${renderer.bodyTextColor.toString(16).padStart(6, '0')}` : null
    },
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse a Super Sticker (liveChatPaidStickerRenderer)
 * @param {object} renderer 
 * @returns {object}
 */
function parseSuperSticker(renderer) {
  if (!renderer) return null;

  const id = renderer.id || '';
  const authorName = renderer.authorName?.simpleText || '';
  const authorChannelId = renderer.authorExternalChannelId || '';
  const thumbnails = renderer.authorPhoto?.thumbnails || [];
  const profilePictureUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
  const badgeInfo = parseBadges(renderer.authorBadges);

  const rawAmount = renderer.purchaseAmountText?.simpleText || '';
  const { amount, currency } = parsePrice(rawAmount);

  const stickerThumbnails = renderer.sticker?.thumbnails || [];
  const stickerUrl = stickerThumbnails.length > 0 ? stickerThumbnails[stickerThumbnails.length - 1].url : '';
  const stickerAlt = renderer.sticker?.accessibility?.accessibilityData?.label || '';

  const timestampUsec = renderer.timestampUsec ? parseInt(renderer.timestampUsec, 10) : Date.now() * 1000;
  const timestamp = new Date(Math.floor(timestampUsec / 1000));

  return {
    type: 'supersticker',
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
    amount,
    currency,
    amountDisplay: rawAmount,
    sticker: {
      url: stickerUrl,
      alt: stickerAlt
    },
    backgroundColor: renderer.backgroundColor ? `#${renderer.backgroundColor.toString(16).padStart(6, '0')}` : null,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse Channel Membership Join / Renewal / Milestone (liveChatMembershipItemRenderer)
 * @param {object} renderer 
 * @returns {object}
 */
function parseMembership(renderer) {
  if (!renderer) return null;

  const id = renderer.id || '';
  const authorName = renderer.authorName?.simpleText || '';
  const authorChannelId = renderer.authorExternalChannelId || '';
  const thumbnails = renderer.authorPhoto?.thumbnails || [];
  const profilePictureUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
  const badgeInfo = parseBadges(renderer.authorBadges);

  const { text: headerSubtext } = extractRunText(renderer.headerSubtext);
  const { text: headerPrimaryText } = extractRunText(renderer.headerPrimaryText);
  const { text: message, emojis } = extractRunText(renderer.message);

  const timestampUsec = renderer.timestampUsec ? parseInt(renderer.timestampUsec, 10) : Date.now() * 1000;
  const timestamp = new Date(Math.floor(timestampUsec / 1000));

  return {
    type: 'membership',
    id,
    author: {
      name: authorName,
      channelId: authorChannelId,
      profilePictureUrl,
      isOwner: badgeInfo.isOwner,
      isModerator: badgeInfo.isModerator,
      isMember: true,
      isVerified: badgeInfo.isVerified,
      badges: badgeInfo.badges
    },
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
 * @returns {object}
 */
function parseGiftMemberships(renderer) {
  if (!renderer) return null;

  const id = renderer.id || '';
  const header = renderer.header?.liveChatSponsorshipsHeaderRenderer;
  const authorName = header?.authorName?.simpleText || '';
  const thumbnails = header?.authorPhoto?.thumbnails || [];
  const profilePictureUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
  const badgeInfo = parseBadges(header?.authorBadges);

  const { text: headerText } = extractRunText(header?.primaryText);

  // Parse gift count e.g. "Gifted 5 channel memberships"
  const countMatch = headerText.match(/(\d+)/);
  const count = countMatch ? parseInt(countMatch[1], 10) : 1;

  const timestampUsec = renderer.timestampUsec ? parseInt(renderer.timestampUsec, 10) : Date.now() * 1000;
  const timestamp = new Date(Math.floor(timestampUsec / 1000));

  return {
    type: 'membership_gift',
    id,
    author: {
      name: authorName,
      channelId: '',
      profilePictureUrl,
      isOwner: badgeInfo.isOwner,
      isModerator: badgeInfo.isModerator,
      isMember: true,
      isVerified: badgeInfo.isVerified,
      badges: badgeInfo.badges
    },
    giftCount: count,
    headerText,
    timestamp,
    timestampUsec,
    raw: renderer
  };
}

/**
 * Parse YouTube Jewels Gift (giftMessageViewModel)
 * YouTube's interactive live gifts feature
 * @param {object} viewModel 
 * @returns {object}
 */
function parseJewelsGift(viewModel) {
  if (!viewModel) return null;

  const id = viewModel.id || '';
  const authorName = viewModel.authorName?.content?.trim() || '';

  // Avatar image
  const avatarSources = viewModel.authorAvatar?.avatarViewModel?.image?.sources || [];
  const profilePictureUrl = avatarSources.length > 0 ? avatarSources[avatarSources.length - 1].url : '';

  // Gift Image
  const giftSources = viewModel.giftImage?.sources || [];
  let giftImageUrl = giftSources.length > 0 ? giftSources[giftSources.length - 1].url : '';
  if (giftImageUrl.startsWith('//')) {
    giftImageUrl = `https:${giftImageUrl}`;
  }

  // Action text e.g. "sent Hiding"
  const actionText = viewModel.text?.content || '';

  // Extract gift name (e.g. "sent Hiding" -> "Hiding")
  let giftName = '';
  if (actionText) {
    giftName = actionText.replace(/^sent\s+/i, '').trim();
  }
  if (!giftName && viewModel.giftImageA11yLabel) {
    const parts = viewModel.giftImageA11yLabel.split(',');
    giftName = parts[parts.length - 1].trim();
  }

  const timestampUsec = Date.now() * 1000;
  const timestamp = new Date();

  return {
    type: 'jewels_gift',
    id,
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
 * @returns {object}
 */
function parseGiftRedemption(renderer) {
  if (!renderer) return null;

  const id = renderer.id || '';
  const authorName = renderer.authorName?.simpleText || '';
  const thumbnails = renderer.authorPhoto?.thumbnails || [];
  const profilePictureUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
  const badgeInfo = parseBadges(renderer.authorBadges);

  const { text: message } = extractRunText(renderer.message);

  // Extract gifter name if present e.g. "was gifted a membership by UserX"
  const gifterMatch = message.match(/by\s+(.+)$/i);
  const gifterName = gifterMatch ? gifterMatch[1].trim() : '';

  const timestampUsec = renderer.timestampUsec ? parseInt(renderer.timestampUsec, 10) : Date.now() * 1000;
  const timestamp = new Date(Math.floor(timestampUsec / 1000));

  return {
    type: 'membership_redeem',
    id,
    author: {
      name: authorName,
      channelId: '',
      profilePictureUrl,
      isOwner: badgeInfo.isOwner,
      isModerator: badgeInfo.isModerator,
      isMember: true,
      isVerified: badgeInfo.isVerified,
      badges: badgeInfo.badges
    },
    gifterName,
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


