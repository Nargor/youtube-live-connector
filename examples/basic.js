'use strict';

const { YouTubeLiveConnector } = require('../src');

// You can pass a live stream URL or video ID or channel handle
const liveUrl = process.argv[2] || 'https://www.youtube.com/watch?v=sgQT3zcN1u4';

const live = new YouTubeLiveConnector(liveUrl);

// 1. Connection established
live.on('connected', (streamInfo) => {
  console.log(`[Connected] Title: "${streamInfo.title}"`);
  console.log(`[Connected] Channel: ${streamInfo.channelName} (${streamInfo.channelUrl})`);
  console.log(`[Connected] Video ID: ${streamInfo.videoId}`);
});

// 2. Chat comments
live.on('chat', (chat) => {
  const badge = chat.author.isOwner ? '[OWNER] ' : (chat.author.isModerator ? '[MOD] ' : (chat.author.isMember ? '[MEMBER] ' : ''));
  console.log(`[Chat] ${badge}${chat.author.name}: ${chat.message}`);
});

// 3. Gifts (Super Chat / Super Sticker / Membership)
live.on('gift', (gift) => {
  if (gift.type === 'superchat') {
    console.log(`[GIFT - Super Chat] ${gift.author.name} sent ${gift.amountDisplay}! Message: "${gift.message}"`);
  } else if (gift.type === 'supersticker') {
    console.log(`[GIFT - Super Sticker] ${gift.author.name} sent ${gift.amountDisplay} (Sticker: ${gift.sticker.alt})`);
  } else if (gift.type === 'membership') {
    console.log(`[GIFT - Membership] ${gift.author.name} joined/renewed: ${gift.headerText}`);
  } else if (gift.type === 'membership_gift') {
    console.log(`[GIFT - Gift Memberships] ${gift.author.name} gifted ${gift.giftCount} memberships!`);
  } else if (gift.type === 'jewels_gift') {
    console.log(`[GIFT - Jewels Gift] ${gift.author.name} ${gift.actionText} (Gift: ${gift.giftName})`);
  }
});

// 4. Live Viewers (updates in real-time)
live.on('viewers', (data) => {
  console.log(`[Viewers] Live Viewers: ${data.viewerCount.toLocaleString()} (${data.viewerCountDisplay})`);
});

// 5. Error handling
live.on('error', (err) => {
  console.error('[Error]', err.message);
});

// 6. Connect to the stream
live.connect().catch((err) => {
  console.error('Failed to connect:', err.message);
});
