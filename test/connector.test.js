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

  // Instantiation with @username
  const c3 = new YouTubeLiveConnector('@webder.nargor');
  assert.equal(c3.initialUrl, '@webder.nargor');
  assert.equal(c3.username, '@webder.nargor');

  // Instantiation with options.username or options.uniqueId
  const c4 = new YouTubeLiveConnector({ username: '@webder.nargor' });
  assert.equal(c4.initialUrl, '@webder.nargor');
  assert.equal(c4.username, '@webder.nargor');

  const c5 = new YouTubeLiveConnector({ uniqueId: 'webder.nargor' });
  assert.equal(c5.initialUrl, 'webder.nargor');
  assert.equal(c5.username, 'webder.nargor');
});

test('YouTubeLiveConnector - connect requires a URL or username', async () => {
  const c = new YouTubeLiveConnector();
  await assert.rejects(async () => {
    await c.connect();
  }, {
    message: /No YouTube URL/
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

test('YouTubeLiveConnector - detects streamEnded and auto-disconnects from viewer poll', async () => {
  const c = new YouTubeLiveConnector({
    url: 'test1234567',
    pollViewers: true,
    autoDisconnectOnEnd: true
  });

  const streamEndedEvents = [];
  const disconnectedEvents = [];

  c.on('streamEnded', (e) => streamEndedEvents.push(e));
  c.on('disconnected', (e) => disconnectedEvents.push(e));

  c.connected = true;
  c.videoId = 'test1234567';
  c.streamInfo = { videoId: 'test1234567', isLive: true };

  // Mock metadata returning updateDateTextAction (stream has ended)
  c.innertube.fetchUpdatedMetadata = async () => ({
    actions: [
      {
        updateDateTextAction: {
          dateText: { simpleText: 'Streamed live on Sep 21, 2026' }
        }
      }
    ]
  });

  await c._pollViewers();

  assert.equal(streamEndedEvents.length, 1);
  assert.equal(streamEndedEvents[0].videoId, 'test1234567');
  assert.equal(streamEndedEvents[0].reason, 'Live stream has ended');
  assert.equal(c.streamInfo.isLive, false);
  assert.equal(c.isConnected(), false);
  assert.equal(disconnectedEvents.length, 1);
  assert.equal(disconnectedEvents[0].reason, 'Live stream has ended');
});

test('YouTubeLiveConnector - detects streamEnded and auto-disconnects from chat continuation exhaustion', async () => {
  const c = new YouTubeLiveConnector({
    url: 'test1234567',
    pollViewers: false,
    autoDisconnectOnEnd: true
  });

  const chatEndedEvents = [];
  const streamEndedEvents = [];
  const disconnectedEvents = [];

  c.on('chatEnded', (e) => chatEndedEvents.push(e));
  c.on('streamEnded', (e) => streamEndedEvents.push(e));
  c.on('disconnected', (e) => disconnectedEvents.push(e));

  c.connected = true;
  c.videoId = 'test1234567';
  c.streamInfo = { videoId: 'test1234567', isLive: true };
  c.chatContinuation = 'token_abc';

  // Mock chat returning no nextContinuation
  c.innertube.fetchLiveChatContinuation = async () => ({
    actions: [],
    nextContinuation: null
  });

  // Poll 1: retry 1
  await c._pollChat();
  assert.equal(chatEndedEvents.length, 1);
  assert.equal(chatEndedEvents[0].retryCount, 1);
  assert.equal(streamEndedEvents.length, 0);
  assert.equal(c.isConnected(), true);

  // Poll 2: retry 2
  await c._pollChat();
  assert.equal(chatEndedEvents.length, 2);
  assert.equal(chatEndedEvents[1].retryCount, 2);
  assert.equal(streamEndedEvents.length, 0);
  assert.equal(c.isConnected(), true);

  // Poll 3: reaches maxChatEndRetries (3) -> emits streamEnded and auto-disconnects
  await c._pollChat();
  assert.equal(chatEndedEvents.length, 3);
  assert.equal(chatEndedEvents[2].retryCount, 3);
  assert.equal(streamEndedEvents.length, 1);
  assert.equal(streamEndedEvents[0].videoId, 'test1234567');
  assert.equal(streamEndedEvents[0].reason, 'Chat continuation exhausted');
  assert.equal(c.isConnected(), false);
  assert.equal(disconnectedEvents.length, 1);
});

test('YouTubeLiveConnector - autoDisconnectOnEnd: false keeps connector open on streamEnded', async () => {
  const c = new YouTubeLiveConnector({
    url: 'test1234567',
    pollViewers: true,
    autoDisconnectOnEnd: false
  });

  const streamEndedEvents = [];
  const disconnectedEvents = [];

  c.on('streamEnded', (e) => streamEndedEvents.push(e));
  c.on('disconnected', (e) => disconnectedEvents.push(e));

  c.connected = true;
  c.videoId = 'test1234567';
  c.streamInfo = { videoId: 'test1234567', isLive: true };

  c.innertube.fetchUpdatedMetadata = async () => ({
    actions: [
      {
        updateDateTextAction: {
          dateText: { simpleText: 'Streamed live on Sep 21, 2026' }
        }
      }
    ]
  });

  await c._pollViewers();

  assert.equal(streamEndedEvents.length, 1);
  assert.equal(c.streamInfo.isLive, false);
  assert.equal(c.isConnected(), true); // still connected because autoDisconnectOnEnd is false
  assert.equal(disconnectedEvents.length, 0);

  c.disconnect();
  assert.equal(c.isConnected(), false);
  assert.equal(disconnectedEvents.length, 1);
});
