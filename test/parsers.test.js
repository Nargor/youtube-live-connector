'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChatMessage } = require('../src/parsers/chatParser');
const {
  parseSuperChat,
  parseSuperSticker,
  parseMembership,
  parseGiftMemberships,
  parseJewelsGift
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

test('parseJewelsGift - correctly parses giftMessageViewModel (YouTube Jewels Gifts)', () => {
  const mockViewModel = {
    id: 'ChwKGkNMYkFpOWFSaTVZREZZWEN3Z1FkMGdJYVR3',
    text: { content: 'sent Hiding' },
    authorName: { content: '@DitsarutSukkong-s7x ' },
    authorAvatar: {
      avatarViewModel: {
        image: {
          sources: [
            { url: 'https://yt4.ggpht.com/avatar_32.jpg', width: 32, height: 32 },
            { url: 'https://yt4.ggpht.com/avatar_64.jpg', width: 64, height: 64 }
          ]
        }
      }
    },
    giftImage: {
      sources: [
        { url: '//www.gstatic.com/youtube/img/pdg/gift/assets/hiding.png=w480-h480', width: 480, height: 480 },
        { url: '//www.gstatic.com/youtube/img/pdg/gift/assets/hiding.png=w640-h640', width: 640, height: 640 }
      ]
    },
    giftImageA11yLabel: '@DitsarutSukkong-s7x sent a gift, Hiding'
  };

  const parsed = parseJewelsGift(mockViewModel);
  assert.equal(parsed.type, 'jewels_gift');
  assert.equal(parsed.id, 'ChwKGkNMYkFpOWFSaTVZREZZWEN3Z1FkMGdJYVR3');
  assert.equal(parsed.author.name, '@DitsarutSukkong-s7x');
  assert.equal(parsed.author.profilePictureUrl, 'https://yt4.ggpht.com/avatar_64.jpg');
  assert.equal(parsed.giftName, 'Hiding');
  assert.equal(parsed.actionText, 'sent Hiding');
  assert.equal(parsed.giftImage.url, 'https://www.gstatic.com/youtube/img/pdg/gift/assets/hiding.png=w640-h640');
  assert.equal(parsed.giftImage.alt, '@DitsarutSukkong-s7x sent a gift, Hiding');
});

