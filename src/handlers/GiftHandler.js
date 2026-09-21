'use strict';

const BaseHandler = require('./BaseHandler');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift,
  parseGiftRedemption
} = require('../parsers/giftParser');

/**
 * GiftHandler
 * Handles gifts and financial contributions:
 * - Super Chat (events: 'gift', 'superchat')
 * - Super Sticker (events: 'gift', 'supersticker')
 * - Channel Memberships (events: 'gift', 'member', 'subscribe', 'follow')
 * - Membership Gifts (events: 'gift', 'memberGift')
 * - Membership Redemptions (events: 'gift', 'memberRedeem')
 * - YouTube Jewels Gifts (events: 'gift', 'jewelsGift')
 */
class GiftHandler extends BaseHandler {
  /**
   * Process incoming action for gifts
   * @param {object} action
   * @param {object} context
   * @returns {boolean}
   */
  handleAction(action, context = {}) {
    const item = action.addChatItemAction?.item ||
                 action.addLiveChatTickerItemAction?.item ||
                 action.addLiveChatItemToGroupAction?.item;
    if (!item) return false;

    // 1. YouTube Jewels Gift (giftMessageViewModel) - Interactive animated live gifts
    if (item.giftMessageViewModel) {
      const jewelsData = parseJewelsGift(item.giftMessageViewModel);
      if (jewelsData && !this.isDuplicate(jewelsData.id)) {
        this.emit('gift', jewelsData);
        this.emit('jewelsGift', jewelsData);
        return true;
      }
    }

    // 2. Super Chat (liveChatPaidMessageRenderer)
    if (item.liveChatPaidMessageRenderer) {
      const superChatData = parseSuperChat(item.liveChatPaidMessageRenderer);
      if (superChatData && !this.isDuplicate(superChatData.id)) {
        this.emit('gift', superChatData);
        this.emit('superchat', superChatData);
        return true;
      }
    }

    // 3. Super Sticker (liveChatPaidStickerRenderer)
    if (item.liveChatPaidStickerRenderer) {
      const stickerData = parseSuperSticker(item.liveChatPaidStickerRenderer);
      if (stickerData && !this.isDuplicate(stickerData.id)) {
        this.emit('gift', stickerData);
        this.emit('supersticker', stickerData);
        return true;
      }
    }

    // 4. Membership Joined / Milestone (liveChatMembershipItemRenderer)
    if (item.liveChatMembershipItemRenderer) {
      const memberData = parseMembership(item.liveChatMembershipItemRenderer);
      if (memberData && !this.isDuplicate(memberData.id)) {
        this.emit('gift', memberData);
        this.emit('member', memberData);
        // Also emit subscribe & follow events for membership joins
        this.emit('subscribe', {
          ...memberData,
          isMembership: true,
          subType: 'membership'
        });
        this.emit('follow', {
          ...memberData,
          isMembership: true,
          subType: 'membership'
        });
        return true;
      }
    }

    // 5. Gift Memberships (liveChatSponsorshipsGiftPurchaseAnnouncementRenderer)
    if (item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
      const giftData = parseGiftMemberships(item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer);
      if (giftData && !this.isDuplicate(giftData.id)) {
        this.emit('gift', giftData);
        this.emit('memberGift', giftData);
        return true;
      }
    }

    // 6. Gift Membership Redeemed (liveChatSponsorshipsGiftRedemptionAnnouncementRenderer)
    if (item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
      const redeemData = parseGiftRedemption(item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer);
      if (redeemData && !this.isDuplicate(redeemData.id)) {
        this.emit('gift', redeemData);
        this.emit('memberRedeem', redeemData);
        return true;
      }
    }

    return false;
  }
}

module.exports = GiftHandler;
