'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractVideoIdSync, resolveVideoId } = require('../src/services/urlResolver');

test('extractVideoIdSync - standard watch URL', () => {
  const id = extractVideoIdSync('https://www.youtube.com/watch?v=sgQT3zcN1u4');
  assert.equal(id, 'sgQT3zcN1u4');
});

test('extractVideoIdSync - watch URL with extra params', () => {
  const id = extractVideoIdSync('https://www.youtube.com/watch?v=sgQT3zcN1u4&feature=share&t=10s');
  assert.equal(id, 'sgQT3zcN1u4');
});

test('extractVideoIdSync - live URL format', () => {
  const id = extractVideoIdSync('https://www.youtube.com/live/sgQT3zcN1u4');
  assert.equal(id, 'sgQT3zcN1u4');
});

test('extractVideoIdSync - youtu.be short URL', () => {
  const id = extractVideoIdSync('https://youtu.be/sgQT3zcN1u4');
  assert.equal(id, 'sgQT3zcN1u4');
});

test('extractVideoIdSync - embed URL format', () => {
  const id = extractVideoIdSync('https://www.youtube.com/embed/sgQT3zcN1u4');
  assert.equal(id, 'sgQT3zcN1u4');
});

test('extractVideoIdSync - raw 11-char ID', () => {
  const id = extractVideoIdSync('sgQT3zcN1u4');
  assert.equal(id, 'sgQT3zcN1u4');
});

test('extractVideoIdSync - invalid inputs return null', () => {
  assert.equal(extractVideoIdSync(''), null);
  assert.equal(extractVideoIdSync(null), null);
  assert.equal(extractVideoIdSync('not-a-valid-id'), null);
  assert.equal(extractVideoIdSync('https://google.com'), null);
});

test('resolveVideoId - synchronous id resolution works directly', async () => {
  const res = await resolveVideoId('sgQT3zcN1u4');
  assert.deepEqual(res, {
    videoId: 'sgQT3zcN1u4',
    finalUrl: 'https://www.youtube.com/watch?v=sgQT3zcN1u4'
  });
});

test('resolveVideoId - invalid or empty input throws error', async () => {
  await assert.rejects(async () => {
    await resolveVideoId('');
  }, {
    message: /No YouTube URL/
  });
});
