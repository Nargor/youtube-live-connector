'use strict';

const { YouTubeLiveConnector } = require('../src');

// Get URL from command line or default to a known stream
const targetUrl = process.argv[2] || 'https://www.youtube.com/watch?v=sgQT3zcN1u4';

console.log('====================================================');
console.log('       YOUTUBE LIVE CONNECTOR - FULL LISTENER       ');
console.log('====================================================');
console.log(`Target: ${targetUrl}`);
console.log('Connecting to YouTube Live...\n');

const live = new YouTubeLiveConnector({
  url: targetUrl,
  pollViewers: true,
  viewerIntervalMs: 5000,
  ignoreInitialChat: false
});

// Event: connected
live.on('connected', (info) => {
  console.log('----------------------------------------------------');
  console.log(' CONNECTED TO YOUTUBE LIVE!');
  console.log(` Title:        ${info.title}`);
  console.log(` Channel:      ${info.channelName} (${info.channelUrl || info.channelId})`);
  console.log(` Video ID:     ${info.videoId}`);
  console.log(` Initial View: ${info.viewerCount.toLocaleString()} watching`);
  console.log('----------------------------------------------------\n');
});

// Event: chat (Comments)
live.on('chat', (data) => {
  const time = data.timestamp.toLocaleTimeString();
  const badges = [];
  if (data.author.isOwner) badges.push('👑 OWNER');
  if (data.author.isModerator) badges.push('🛡️ MOD');
  if (data.author.isMember) badges.push('⭐ MEMBER');
  if (data.author.isVerified) badges.push('✔️ VERIFIED');
  const badgeStr = badges.length > 0 ? `[${badges.join(' ')}] ` : '';

  console.log(`💬 [${time}] ${badgeStr}${data.author.name}: ${data.message}`);
});

// Event: gift (Unified monetization event - Super Chat / Sticker / Memberships)
live.on('gift', (gift) => {
  const time = gift.timestamp.toLocaleTimeString();
  console.log('\n🎁 =================== GIFT RECEIVED ===================');
  console.log(` Time:   [${time}]`);
  console.log(` Type:   ${gift.type.toUpperCase()}`);
  console.log(` From:   ${gift.author.name}`);

  if (gift.type === 'superchat') {
    console.log(` Amount: ${gift.amountDisplay} (${gift.amount} ${gift.currency})`);
    if (gift.message) console.log(` Message: "${gift.message}"`);
  } else if (gift.type === 'supersticker') {
    console.log(` Amount: ${gift.amountDisplay} (${gift.amount} ${gift.currency})`);
    console.log(` Sticker: ${gift.sticker.alt} (${gift.sticker.url})`);
  } else if (gift.type === 'membership') {
    console.log(` Details: ${gift.headerText || gift.subtext}`);
    if (gift.message) console.log(` Message: "${gift.message}"`);
  } else if (gift.type === 'membership_gift') {
    console.log(` Details: ${gift.headerText}`);
    console.log(` Count:   ${gift.giftCount} memberships`);
  } else if (gift.type === 'jewels_gift') {
    console.log(` Action:  ${gift.actionText}`);
    console.log(` Gift:    ${gift.giftName}`);
    if (gift.giftImage?.url) console.log(` Image:   ${gift.giftImage.url}`);
  }
  console.log('=======================================================\n');
});

// Event: jewelsGift (Specific event for YouTube Jewels Gifts)
live.on('jewelsGift', (gift) => {
  // You can also handle Jewels Gifts specifically here if desired
});

// Event: superchat (Specific event for Super Chats)
live.on('superchat', (data) => {
  // You can also handle Super Chats specifically here if desired
});

// Event: supersticker (Specific event for Super Stickers)
live.on('supersticker', (data) => {
  // You can also handle Super Stickers specifically here if desired
});

// Event: member (Specific event for Membership join/renew)
live.on('member', (data) => {
  // You can also handle Memberships specifically here if desired
});

// Event: memberGift (Specific event for Gifted Memberships)
live.on('memberGift', (data) => {
  // You can also handle Gifted Memberships specifically here if desired
});

// Event: viewers / roomUser (Live concurrent viewers)
live.on('viewers', (data) => {
  const time = data.timestamp.toLocaleTimeString();
  console.log(`👥 [${time}] [Viewers] Current live viewers: ${data.viewerCount.toLocaleString()}`);
});

// Event: title (Title changed)
live.on('title', (data) => {
  console.log(`📢 [Title Updated] New title: "${data.title}"`);
});

// Event: like (Like count updated)
live.on('like', (data) => {
  console.log(`👍 [Likes Updated] ${data.likeCount}`);
});

// Event: warning
live.on('warning', (data) => {
  console.warn(`⚠️ [Warning] ${data.message}`);
});

// Event: error
live.on('error', (err) => {
  console.error(`❌ [Error] ${err.message}`);
});

// Event: disconnected
live.on('disconnected', (data) => {
  console.log(`\n🔌 Disconnected from YouTube Live: ${data.reason}`);
});

// Handle graceful exit
process.on('SIGINT', () => {
  console.log('\nStopping connector...');
  live.disconnect('User interrupted (SIGINT)');
  process.exit(0);
});

// Start connection
live.connect().catch((err) => {
  console.error('Fatal connection error:', err.message);
  process.exit(1);
});
