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
    }
  ];

  c._processActions(mockActions);

  assert.equal(emitted.length, 3);
  assert.equal(emitted[0].event, 'chat');
  assert.equal(emitted[0].data.message, 'Hello!');

  assert.equal(emitted[1].event, 'gift');
  assert.equal(emitted[1].data.amount, 200);

  assert.equal(emitted[2].event, 'superchat');
  assert.equal(emitted[2].data.amount, 200);
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
