'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('import - CommonJS default require', () => {
  const YouTubeLiveConnector = require('../src');
  assert.equal(typeof YouTubeLiveConnector, 'function');
  const instance = new YouTubeLiveConnector('sgQT3zcN1u4');
  assert.equal(instance.initialUrl, 'sgQT3zcN1u4');
});

test('import - CommonJS destructuring require', () => {
  const { YouTubeLiveConnector } = require('../src');
  assert.equal(typeof YouTubeLiveConnector, 'function');
  const instance = new YouTubeLiveConnector('sgQT3zcN1u4');
  assert.equal(instance.initialUrl, 'sgQT3zcN1u4');
});

test('import - CommonJS attached helper utilities', () => {
  const YouTubeLiveConnector = require('../src');
  assert.equal(typeof YouTubeLiveConnector.resolveVideoId, 'function');
  assert.equal(typeof YouTubeLiveConnector.extractVideoIdSync, 'function');
  assert.equal(typeof YouTubeLiveConnector.parseChatMessage, 'function');
  assert.equal(typeof YouTubeLiveConnector.parseSuperChat, 'function');
  assert.equal(typeof YouTubeLiveConnector.ChatHandler, 'function');
  assert.equal(typeof YouTubeLiveConnector.GiftHandler, 'function');
  assert.equal(typeof YouTubeLiveConnector.LikeHandler, 'function');
  assert.equal(typeof YouTubeLiveConnector.ReactionHandler, 'function');
  assert.equal(typeof YouTubeLiveConnector.ViewerHandler, 'function');
  assert.equal(typeof YouTubeLiveConnector.EngagementHandler, 'function');
  assert.equal(typeof YouTubeLiveConnector.StreamLifecycleHandler, 'function');
});

test('import - ES Module dynamic import', async () => {
  const esm = await import('../src/index.mjs');
  assert.equal(typeof esm.default, 'function');
  assert.equal(typeof esm.YouTubeLiveConnector, 'function');
  assert.equal(typeof esm.ChatHandler, 'function');
  assert.equal(typeof esm.GiftHandler, 'function');
  const instance = new esm.YouTubeLiveConnector('sgQT3zcN1u4');
  assert.equal(instance.initialUrl, 'sgQT3zcN1u4');
});
