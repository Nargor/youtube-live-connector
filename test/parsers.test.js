'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChatMessage } = require('../src/parsers/chatParser');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships
} = require('../src/parsers/giftParser');
const { parseViewerCount, parsePrice } = require('../src/utils/helpers');

test('parseViewerCount - handles standard and abbreviated formats', () => {
  assert.equal(parseViewerCount('4,532 watching now'), 4532);
  assert.equal(parseViewerCount('59,340 watching now'), 59340);
  assert.equal(parseViewerCount('10K watching now'), 10000);
  assert.equal(parseViewerCount('1.5M watching now'), 1500000);
  assert.equal(parseViewerCount('100 watching'), 100);
  assert.equal(parseViewerCount(null), 0);
  assert.equal(parseViewerCount(''), 0);
});

test('parsePrice - parses various currencies and decimals', () => {
  assert.deepEqual(parsePrice('$5.00'), { amount: 5, currency: '$', raw: '$5.00' });
  assert.deepEqual(parsePrice('฿100.00'), { amount: 100, currency: '฿', raw: '฿100.00' });
  assert.deepEqual(parsePrice('€10,50'), { amount: 10.5, currency: '€', raw: '€10,50' });
  assert.deepEqual(parsePrice('¥500'), { amount: 500, currency: '¥', raw: '¥500' });
});

test('parseChatMessage - correctly parses liveChatTextMessageRenderer', () => {
  const mockRenderer = {
    id: 'msg_123',
    timestampUsec: '1700000000000000',
    authorExternalChannelId: 'UC123456789',
    authorName: { simpleText: 'TestUser' },
    authorPhoto: {
      thumbnails: [{ url: 'https://example.com/avatar.jpg' }]
    },
    authorBadges: [
      {
        liveChatAuthorBadgeRenderer: {
          tooltip: 'Moderator',
          icon: { iconType: 'MODERATOR' }
        }
      }
    ],
    message: {
      runs: [
        { text: 'Hello ' },
        {
          emoji: {
            emojiId: 'smile',
            shortcuts: [':smile:'],
            image: { thumbnails: [{ url: 'https://example.com/smile.png' }] }
          }
        }
      ]
    }
  };

  const parsed = parseChatMessage(mockRenderer);
  assert.equal(parsed.id, 'msg_123');
  assert.equal(parsed.author.name, 'TestUser');
  assert.equal(parsed.author.channelId, 'UC123456789');
  assert.equal(parsed.author.isModerator, true);
  assert.equal(parsed.author.isOwner, false);
  assert.equal(parsed.author.profilePictureUrl, 'https://example.com/avatar.jpg');
  assert.equal(parsed.message, 'Hello :smile:');
  assert.equal(parsed.emojis.length, 1);
  assert.equal(parsed.emojis[0].name, ':smile:');
});

test('parseSuperChat - correctly parses liveChatPaidMessageRenderer', () => {
  const mockRenderer = {
    id: 'sc_456',
    timestampUsec: '1700000000000000',
    authorExternalChannelId: 'UC987654321',
    authorName: { simpleText: 'SuperFan' },
    authorPhoto: { thumbnails: [{ url: 'https://example.com/fan.jpg' }] },
    purchaseAmountText: { simpleText: '฿500.00' },
    headerBackgroundColor: 4286267099,
    message: { runs: [{ text: 'Awesome stream!' }] }
  };

  const parsed = parseSuperChat(mockRenderer);
  assert.equal(parsed.type, 'superchat');
  assert.equal(parsed.id, 'sc_456');
  assert.equal(parsed.author.name, 'SuperFan');
  assert.equal(parsed.amount, 500);
  assert.equal(parsed.currency, '฿');
  assert.equal(parsed.amountDisplay, '฿500.00');
  assert.equal(parsed.message, 'Awesome stream!');
});

test('parseSuperSticker - correctly parses liveChatPaidStickerRenderer', () => {
  const mockRenderer = {
    id: 'st_789',
    timestampUsec: '1700000000000000',
    authorName: { simpleText: 'StickerSender' },
    purchaseAmountText: { simpleText: '$2.00' },
    sticker: {
      thumbnails: [{ url: 'https://example.com/sticker.png' }],
      accessibility: { accessibilityData: { label: 'Happy cat sticker' } }
    }
  };

  const parsed = parseSuperSticker(mockRenderer);
  assert.equal(parsed.type, 'supersticker');
  assert.equal(parsed.amount, 2);
  assert.equal(parsed.currency, '$');
  assert.equal(parsed.sticker.url, 'https://example.com/sticker.png');
  assert.equal(parsed.sticker.alt, 'Happy cat sticker');
});

test('parseMembership - correctly parses liveChatMembershipItemRenderer', () => {
  const mockRenderer = {
    id: 'mb_101',
    timestampUsec: '1700000000000000',
    authorName: { simpleText: 'NewMember' },
    headerSubtext: { runs: [{ text: 'Member for 6 months' }] },
    message: { runs: [{ text: 'Proud to support!' }] }
  };

  const parsed = parseMembership(mockRenderer);
  assert.equal(parsed.type, 'membership');
  assert.equal(parsed.author.name, 'NewMember');
  assert.equal(parsed.author.isMember, true);
  assert.equal(parsed.subtext, 'Member for 6 months');
  assert.equal(parsed.message, 'Proud to support!');
});

test('parseGiftMemberships - correctly parses sponsorships gift purchase', () => {
  const mockRenderer = {
    id: 'gift_202',
    timestampUsec: '1700000000000000',
    header: {
      liveChatSponsorshipsHeaderRenderer: {
        authorName: { simpleText: 'GenerousDonor' },
        primaryText: { runs: [{ text: 'Gifted 5 channel memberships' }] }
      }
    }
  };

  const parsed = parseGiftMemberships(mockRenderer);
  assert.equal(parsed.type, 'membership_gift');
  assert.equal(parsed.author.name, 'GenerousDonor');
  assert.equal(parsed.giftCount, 5);
  assert.equal(parsed.headerText, 'Gifted 5 channel memberships');
});
