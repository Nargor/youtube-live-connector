'use strict';

const { YouTubeLiveConnector } = require('../src');

const target = 'https://www.youtube.com/watch?v=sgQT3zcN1u4';
console.log('Connecting to:', target);

const live = new YouTubeLiveConnector(target);

let chatCount = 0;
let viewerUpdates = 0;

live.on('connected', (info) => {
  console.log('[TEST] Connected to:', info.title);
  console.log('[TEST] Channel:', info.channelName);
  console.log('[TEST] Initial viewers:', info.viewerCount);
});

live.on('chat', (chat) => {
  chatCount++;
  if (chatCount <= 5) {
    console.log('[TEST CHAT #' + chatCount + '] ' + chat.author.name + ': ' + chat.message);
  }
});

live.on('viewers', (v) => {
  viewerUpdates++;
  console.log('[TEST VIEWERS #' + viewerUpdates + '] ' + v.viewerCount + ' (' + v.viewerCountDisplay + ')');
});

live.on('gift', (g) => {
  console.log('[TEST GIFT]', g.type, g.author.name, g.amountDisplay || g.headerText);
});

live.on('error', (err) => {
  console.error('[TEST ERROR]', err.message);
});

live.connect().then(() => {
  setTimeout(() => {
    console.log('[TEST FINISHED] Total chats:', chatCount, 'Total viewer updates:', viewerUpdates);
    live.disconnect();
    process.exit(0);
  }, 12000);
}).catch(err => {
  console.error('[TEST FATAL]', err);
  process.exit(1);
});
