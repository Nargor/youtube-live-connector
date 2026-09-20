'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const YouTubeLiveConnector = require('../src/YouTubeLiveConnector');

test('YouTubeLiveConnector - instantiation with string or options', () => {
  const c1 = new YouTubeLiveConnector('https://www.youtube.com/watch?v=sgQT3zcN1u4');
  assert.equal(c1.initialUrl, 'https://www.youtube.com/watch?v=sgQT3zcN1u4');
  assert.equal(c1.isConnected(), false);

  const c2 = new YouTubeLiveConnector({
    url: 'sgQT3zcN1u4',
    pollViewers: false,
    viewerIntervalMs: 10000
  });
  assert.equal(c2.initialUrl, 'sgQT3zcN1u4');
  assert.equal(c2.pollViewersEnabled, false);
  assert.equal(c2.viewerIntervalMs, 10000);
});

test('YouTubeLiveConnector - connect requires a URL', async () => {
  const c = new YouTubeLiveConnector();
  await assert.rejects(async () => {
    await c.connect();
  }, {
    message: 'No YouTube URL or Video ID provided.'
  });
});

test('YouTubeLiveConnector - deduplication of messages works', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  assert.equal(c._isDuplicate('id_1'), false);
  assert.equal(c._isDuplicate('id_1'), true);
  assert.equal(c._isDuplicate('id_2'), false);
});

test('YouTubeLiveConnector - emits chat and gift events on _processActions', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  const emitted = [];

  c.on('chat', (data) => emitted.push({ event: 'chat', data }));
  c.on('gift', (data) => emitted.push({ event: 'gift', data }));
  c.on('superchat', (data) => emitted.push({ event: 'superchat', data }));
  c.on('jewelsGift', (data) => emitted.push({ event: 'jewelsGift', data }));

  const mockActions = [
    {
      addChatItemAction: {
        item: {
          liveChatTextMessageRenderer: {
            id: 'c_1',
            authorName: { simpleText: 'Alice' },
            message: { runs: [{ text: 'Hello!' }] }
          }
        }
      }
    },
    {
      addChatItemAction: {
        item: {
          liveChatPaidMessageRenderer: {
            id: 'sc_1',
            authorName: { simpleText: 'Bob' },
            purchaseAmountText: { simpleText: '฿200.00' },
            message: { runs: [{ text: 'Take my money!' }] }
          }
        }
      }
    },
    {
      addChatItemAction: {
        item: {
          giftMessageViewModel: {
            id: 'jg_1',
            text: { content: 'sent Hiding' },
            authorName: { content: '@Viewer123' },
            giftImageA11yLabel: '@Viewer123 sent a gift, Hiding'
          }
        }
      }
    }
  ];

  c._processActions(mockActions);

  assert.equal(emitted.length, 5);
  assert.equal(emitted[0].event, 'chat');
  assert.equal(emitted[0].data.message, 'Hello!');

  assert.equal(emitted[1].event, 'gift');
  assert.equal(emitted[1].data.amount, 200);

  assert.equal(emitted[2].event, 'superchat');
  assert.equal(emitted[2].data.amount, 200);

  assert.equal(emitted[3].event, 'gift');
  assert.equal(emitted[3].data.type, 'jewels_gift');
  assert.equal(emitted[3].data.giftName, 'Hiding');

  assert.equal(emitted[4].event, 'jewelsGift');
  assert.equal(emitted[4].data.giftName, 'Hiding');
});

test('YouTubeLiveConnector - emits viewers and roomUser alias', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  let viewersCount = 0;
  let roomUserCount = 0;

  c.on('viewers', (d) => { viewersCount = d.viewerCount; });
  c.on('roomUser', (d) => { roomUserCount = d.viewerCount; });

  c._emitViewerCount(1234, '1,234 watching now');

  assert.equal(viewersCount, 1234);
  assert.equal(roomUserCount, 1234);
});

test('YouTubeLiveConnector - disconnect stops timers and emits disconnected', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  c.connected = true;
  let disconnectedReason = null;

  c.on('disconnected', (d) => { disconnectedReason = d.reason; });
  c.disconnect('Custom stop');

  assert.equal(c.isConnected(), false);
  assert.equal(disconnectedReason, 'Custom stop');
});

test('YouTubeLiveConnector - emits reactions and reaction events with deduplication', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  const batches = [];
  const individualReactions = [];

  c.on('reactions', (b) => batches.push(b));
  c.on('reaction', (r) => individualReactions.push(r));

  const mockMutations = [
    {
      payload: {
        emojiFountainDataEntity: {
          key: 'key_1',
          reactionBuckets: [
            {
              totalReactions: 3,
              intensityScore: 0.75,
              reactionsData: [
                { unicodeEmojiId: '❤', reactionCount: 2 },
                { unicodeEmojiId: '🎉', reactionCount: 1 }
              ]
            }
          ],
          updateTimeUsec: '1000000'
        }
      }
    }
  ];

  c._processReactions(mockMutations);

  assert.equal(batches.length, 1);
  assert.equal(batches[0].totalReactions, 3);
  assert.equal(individualReactions.length, 2);
  assert.equal(individualReactions[0].emoji, '❤');
  assert.equal(individualReactions[0].count, 2);
  assert.equal(individualReactions[1].emoji, '🎉');
  assert.equal(individualReactions[1].count, 1);

  // Re-processing same updateTimeUsec should be deduplicated
  c._processReactions(mockMutations);
  assert.equal(batches.length, 1);
  assert.equal(individualReactions.length, 2);

  // New updateTimeUsec should be processed
  const newMutations = [
    {
      payload: {
        emojiFountainDataEntity: {
          key: 'key_1',
          reactionBuckets: [
            {
              totalReactions: 1,
              intensityScore: 0.5,
              reactionsData: [
                { unicodeEmojiId: '💯', reactionCount: 1 }
              ]
            }
          ],
          updateTimeUsec: '2000000'
        }
      }
    }
  ];
  c._processReactions(newMutations);
  assert.equal(batches.length, 2);
  assert.equal(individualReactions.length, 3);
  assert.equal(individualReactions[2].emoji, '💯');
});

test('YouTubeLiveConnector - emits subscribe and follow events on membership', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  const subs = [];
  const follows = [];

  c.on('subscribe', (d) => subs.push(d));
  c.on('follow', (d) => follows.push(d));

  const mockActions = [
    {
      addChatItemAction: {
        item: {
          liveChatMembershipItemRenderer: {
            id: 'mem_1',
            authorName: { simpleText: 'SuperMember' },
            headerSubtext: { runs: [{ text: 'Welcome to VIP!' }] }
          }
        }
      }
    }
  ];

  c._processActions(mockActions);

  assert.equal(subs.length, 1);
  assert.equal(subs[0].author.name, 'SuperMember');
  assert.equal(subs[0].isMembership, true);
  assert.equal(follows.length, 1);
  assert.equal(follows[0].author.name, 'SuperMember');
});

test('YouTubeLiveConnector - emits subscribe and follow events on engagement notice', () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  const subs = [];
  const engagements = [];

  c.on('subscribe', (d) => subs.push(d));
  c.on('engagement', (d) => engagements.push(d));

  const mockActions = [
    {
      addChatItemAction: {
        item: {
          liveChatViewerEngagementMessageRenderer: {
            id: 'eng_sub_1',
            message: { runs: [{ text: 'Subscribe to join the community!' }] }
          }
        }
      }
    }
  ];

  c._processActions(mockActions);

  assert.equal(engagements.length, 1);
  assert.equal(engagements[0].isSubscribeNotice, true);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].subType, 'engagement_notice');
});

test('YouTubeLiveConnector - computes like increments and emits like event', async () => {
  const c = new YouTubeLiveConnector('sgQT3zcN1u4');
  c.connected = true;
  c.pollViewersEnabled = true;
  c.lastLikeCount = 0;
  c.streamInfo = { viewerCount: 0, likeCount: 0 };
  c._scheduleViewerPoll = () => {};

  const likeEvents = [];
  c.on('like', (d) => likeEvents.push(d));

  try {
    // Mock innertube fetchUpdatedMetadata
    c.innertube.fetchUpdatedMetadata = async () => ({
      actions: [
        {
          updateToggleMenuServiceItemAction: {
            defaultText: { simpleText: '10' }
          }
        }
      ]
    });

    await c._pollViewers();
    assert.equal(likeEvents.length, 1);
    assert.equal(likeEvents[0].likeCount, 10);
    assert.equal(likeEvents[0].likesIncrement, 10);

    // Second poll with increase to 15
    c.innertube.fetchUpdatedMetadata = async () => ({
      actions: [
        {
          updateToggleMenuServiceItemAction: {
            defaultText: { simpleText: '15' }
          }
        }
      ]
    });

    await c._pollViewers();
    assert.equal(likeEvents.length, 2);
    assert.equal(likeEvents[1].likeCount, 15);
    assert.equal(likeEvents[1].likesIncrement, 5);

    // Third poll with same count should NOT emit duplicate
    await c._pollViewers();
    assert.equal(likeEvents.length, 2);
  } finally {
    c.disconnect();
  }
});
