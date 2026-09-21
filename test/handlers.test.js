'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const {
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
} = require('../src/handlers');

// Helper to create a mock connector
function createMockConnector(overrides = {}) {
  const emitter = new EventEmitter();
  const processed = new Set();
  emitter.videoId = 'vid_123';
  emitter.streamInfo = { videoId: 'vid_123', isLive: true };
  emitter.autoDisconnectOnEnd = true;
  emitter._isDuplicate = (id) => {
    if (processed.has(id)) return true;
    processed.add(id);
    return false;
  };
  emitter.disconnect = (reason) => {
    emitter.connected = false;
    emitter.emit('disconnected', { reason });
  };
  emitter.connected = true;
  Object.assign(emitter, overrides);
  return emitter;
}

test('BaseHandler - requires connector and provides emit/isDuplicate', () => {
  assert.throws(() => new BaseHandler(), /requires a connector/);

  const connector = createMockConnector();
  const handler = new BaseHandler(connector);

  let received = null;
  connector.on('test_event', (data) => { received = data; });

  handler.emit('test_event', { ok: true });
  assert.deepEqual(received, { ok: true });

  assert.equal(handler.isDuplicate('id_1'), false);
  assert.equal(handler.isDuplicate('id_1'), true);
});

test('ChatHandler - handles liveChatTextMessageRenderer and emits chat', () => {
  const connector = createMockConnector();
  const handler = new ChatHandler(connector);

  const chats = [];
  connector.on('chat', (c) => chats.push(c));

  const action = {
    addChatItemAction: {
      item: {
        liveChatTextMessageRenderer: {
          id: 'chat_1',
          authorName: { simpleText: 'Alice' },
          message: { runs: [{ text: 'Hello OOP!' }] }
        }
      }
    }
  };

  const handled = handler.handleAction(action);
  assert.equal(handled, true);
  assert.equal(chats.length, 1);
  assert.equal(chats[0].message, 'Hello OOP!');
  assert.equal(chats[0].author.name, 'Alice');

  // Duplicate should not emit
  const handledDuplicate = handler.handleAction(action);
  assert.equal(handledDuplicate, false);
  assert.equal(chats.length, 1);
});

test('GiftHandler - handles superchat, supersticker, jewels, and memberships', () => {
  const connector = createMockConnector();
  const handler = new GiftHandler(connector);

  const gifts = [];
  const superchats = [];
  const superstickers = [];
  const members = [];
  const jewels = [];

  connector.on('gift', (g) => gifts.push(g));
  connector.on('superchat', (s) => superchats.push(s));
  connector.on('supersticker', (s) => superstickers.push(s));
  connector.on('member', (m) => members.push(m));
  connector.on('jewelsGift', (j) => jewels.push(j));

  // 1. Superchat
  handler.handleAction({
    addChatItemAction: {
      item: {
        liveChatPaidMessageRenderer: {
          id: 'sc_1',
          authorName: { simpleText: 'Bob' },
          purchaseAmountText: { simpleText: '฿100.00' },
          message: { runs: [{ text: 'Great stream!' }] }
        }
      }
    }
  });

  // 2. Super Sticker
  handler.handleAction({
    addChatItemAction: {
      item: {
        liveChatPaidStickerRenderer: {
          id: 'ss_1',
          authorName: { simpleText: 'Charlie' },
          purchaseAmountText: { simpleText: '฿50.00' },
          sticker: { thumbnails: [{ url: 'https://example.com/sticker.png' }] }
        }
      }
    }
  });

  // 3. Jewels Gift
  handler.handleAction({
    addChatItemAction: {
      item: {
        giftMessageViewModel: {
          id: 'jg_1',
          text: { content: 'sent Party' },
          authorName: { content: '@Viewer' }
        }
      }
    }
  });

  // 4. Membership Join
  handler.handleAction({
    addChatItemAction: {
      item: {
        liveChatMembershipItemRenderer: {
          id: 'mem_1',
          authorName: { simpleText: 'Dave' },
          headerSubtext: { runs: [{ text: 'Welcome to VIP!' }] }
        }
      }
    }
  });

  assert.equal(gifts.length, 4);
  assert.equal(superchats.length, 1);
  assert.equal(superstickers.length, 1);
  assert.equal(jewels.length, 1);
  assert.equal(members.length, 1);
});

test('LikeHandler - tracks likes and increments', () => {
  const connector = createMockConnector();
  const handler = new LikeHandler(connector);

  const likes = [];
  connector.on('like', (l) => likes.push(l));

  // Initialize
  handler.initialize(10, '10');
  assert.equal(likes.length, 1);
  assert.equal(likes[0].likeCount, 10);
  assert.equal(likes[0].likesIncrement, 0);

  // Update to 15
  handler.handleMetadata({ likeCount: 15, likeCountDisplay: '15' });
  assert.equal(likes.length, 2);
  assert.equal(likes[1].likeCount, 15);
  assert.equal(likes[1].likesIncrement, 5);

  // Same count should NOT emit
  handler.handleMetadata({ likeCount: 15, likeCountDisplay: '15' });
  assert.equal(likes.length, 2);

  // Reset
  handler.reset();
  assert.equal(handler.lastLikeCount, null);
});

test('ReactionHandler - handles floating emoji reactions batch and individual', () => {
  const connector = createMockConnector();
  const handler = new ReactionHandler(connector);

  const batchReactions = [];
  const singleReactions = [];

  connector.on('reactions', (r) => batchReactions.push(r));
  connector.on('reaction', (r) => singleReactions.push(r));

  const mockMutations = [
    {
      payload: {
        emojiFountainDataEntity: {
          key: 'fountain_key_1',
          updateTimeUsec: '1700000001000',
          reactionBuckets: [
            {
              totalReactions: 2,
              duration: { seconds: '1' },
              intensityScore: 0.9,
              reactionsData: [
                { unicodeEmojiId: '❤', reactionCount: 1 },
                { unicodeEmojiId: '🔥', reactionCount: 1 }
              ]
            }
          ]
        }
      }
    }
  ];

  handler.handleFrameworkUpdate(mockMutations);

  assert.equal(batchReactions.length, 1);
  assert.equal(singleReactions.length, 2);
  assert.equal(singleReactions[0].emoji, '❤');
  assert.equal(singleReactions[1].emoji, '🔥');

  // Duplicate timestamp should NOT emit
  handler.handleFrameworkUpdate(mockMutations);
  assert.equal(batchReactions.length, 1);
});

test('ViewerHandler - handles viewers and roomUser alias', () => {
  const connector = createMockConnector();
  const handler = new ViewerHandler(connector);

  const viewersEvents = [];
  const roomUserEvents = [];

  connector.on('viewers', (v) => viewersEvents.push(v));
  connector.on('roomUser', (v) => roomUserEvents.push(v));

  handler.initialize(120, '120 watching');
  assert.equal(viewersEvents.length, 1);
  assert.equal(roomUserEvents.length, 1);
  assert.equal(viewersEvents[0].viewerCount, 120);

  handler.handleMetadata({ viewerCount: 200, viewerCountDisplay: '200 watching' });
  assert.equal(viewersEvents.length, 2);
  assert.equal(roomUserEvents.length, 2);
  assert.equal(viewersEvents[1].viewerCount, 200);
});

test('EngagementHandler - handles notices and emits subscribe/follow', () => {
  const connector = createMockConnector();
  const handler = new EngagementHandler(connector);

  const engagements = [];
  const subscribes = [];

  connector.on('engagement', (e) => engagements.push(e));
  connector.on('subscribe', (s) => subscribes.push(s));

  handler.handleAction({
    addChatItemAction: {
      item: {
        liveChatViewerEngagementMessageRenderer: {
          id: 'eng_notice_1',
          message: { runs: [{ text: 'Don’t forget to subscribe to the channel!' }] }
        }
      }
    }
  });

  assert.equal(engagements.length, 1);
  assert.equal(subscribes.length, 1);
  assert.equal(subscribes[0].subType, 'engagement_notice');
});

test('StreamLifecycleHandler - handles title, streamEnded, chatEnded, and autoDisconnect', () => {
  const connector = createMockConnector();
  const handler = new StreamLifecycleHandler(connector);

  const titles = [];
  const streamEndeds = [];
  const chatEndeds = [];
  const disconnecteds = [];

  connector.on('title', (t) => titles.push(t));
  connector.on('streamEnded', (e) => streamEndeds.push(e));
  connector.on('chatEnded', (e) => chatEndeds.push(e));
  connector.on('disconnected', (d) => disconnecteds.push(d));

  // Title change
  handler.handleMetadata({ title: 'New Stream Title' });
  assert.equal(titles.length, 1);
  assert.equal(titles[0].title, 'New Stream Title');

  // Stream ended via isLive: false
  handler.handleMetadata({ isLive: false });
  assert.equal(streamEndeds.length, 1);
  assert.equal(streamEndeds[0].reason, 'Live stream has ended');
  assert.equal(connector.connected, false); // auto-disconnected
  assert.equal(disconnecteds.length, 1);

  // Duplicate stream ended should not fire
  handler.handleStreamEnded('Should be ignored');
  assert.equal(streamEndeds.length, 1);
});

test('HandlerRegistry - coordinates all handlers seamlessly', () => {
  const connector = createMockConnector();
  const registry = new HandlerRegistry(connector);

  const chats = [];
  const gifts = [];

  connector.on('chat', (c) => chats.push(c));
  connector.on('gift', (g) => gifts.push(g));

  registry.dispatchActions([
    {
      addChatItemAction: {
        item: {
          liveChatTextMessageRenderer: {
            id: 'reg_chat_1',
            authorName: { simpleText: 'Alice' },
            message: { runs: [{ text: 'Hello Registry!' }] }
          }
        }
      }
    },
    {
      addChatItemAction: {
        item: {
          liveChatPaidMessageRenderer: {
            id: 'reg_sc_1',
            authorName: { simpleText: 'Bob' },
            purchaseAmountText: { simpleText: '฿20.00' },
            message: { runs: [{ text: 'Nice!' }] }
          }
        }
      }
    }
  ]);

  assert.equal(chats.length, 1);
  assert.equal(gifts.length, 1);
});
