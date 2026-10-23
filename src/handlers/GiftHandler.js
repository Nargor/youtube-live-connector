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

const GIFT_CONFIGS = [
  { key: 'giftMessageViewModel', parse: parseJewelsGift, event: 'jewelsGift' },
  { key: 'liveChatPaidMessageRenderer', parse: parseSuperChat, event: 'superchat' },
  { key: 'liveChatPaidStickerRenderer', parse: parseSuperSticker, event: 'supersticker' },
  { key: 'liveChatMembershipItemRenderer', parse: parseMembership, event: 'member', extraEvents: ['subscribe', 'follow'] },
  { key: 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer', parse: parseGiftMemberships, event: 'memberGift' },
  { key: 'liveChatSponsorshipsGiftRedemptionAnnouncementRenderer', parse: parseGiftRedemption, event: 'memberRedeem' }
];

/**
 * GiftHandler
 * Handles gifts, super chats, super stickers, memberships, and jewels
 */
class GiftHandler extends BaseHandler {
  handleAction(action) {
    const item = this.getActionItem(action);
    if (!item) return false;

    for (const { key, parse, event, extraEvents } of GIFT_CONFIGS) {
      if (item[key]) {
        const data = parse(item[key]);
        if (data && !this.isDuplicate(data.id)) {
          this.emit('gift', data);
          this.emit(event, data);
          if (extraEvents) {
            const extra = { ...data, isMembership: true, subType: 'membership' };
            for (const ev of extraEvents) this.emit(ev, extra);
          }
          return true;
        }
      }
    }

    return false;
  }
}

module.exports = GiftHandler;
