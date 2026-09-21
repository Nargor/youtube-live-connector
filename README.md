# youtube-live-connector

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**youtube-live-connector** เป็นไลบรารี Node.js สำหรับเชื่อมต่อกับ **YouTube Live** เพื่อดึงข้อมูลแชท/คอมเมนต์, ของขวัญ (Super Chat, Super Sticker, สมาชิก/Memberships, Jewels Gifts), และจำนวนคนดูสดแบบ Real-time ด้วยโครงสร้าง Event-driven ที่ใช้งานง่าย

> 💡 **จุดเด่น**: ไม่ต้องใช้ Google Cloud Console API Key (Keyless) และไม่มีปัญหาโควต้า API Quota รายวันเต็ม!

---

## สารบัญ / Table of Contents
- [คุณสมบัติเด่น (Features)](#คุณสมบัติเด่น-features)
- [การติดตั้ง (Installation)](#การติดตั้ง-installation)
- [เริ่มต้นใช้งาน (Quick Start)](#เริ่มต้นใช้งาน-quick-start)
- [รายการ Events ทั้งหมด (Events List)](#รายการ-events-ทั้งหมด-events-list)
  - [`connected`](#event-connected)
  - [`chat`](#event-chat)
  - [`gift` (Super Chat, Sticker, Membership)](#event-gift)
  - [`viewers` / `roomUser`](#event-viewers--roomuser)
- [รองรับ YouTube Link ทุกรูปแบบ](#รองรับ-youtube-link-ทุกรูปแบบ)
- [ตัวเลือกการตั้งค่า (Options)](#ตัวเลือกการตั้งค่า-options)
- [ตัวอย่างการใช้งานแบบเต็ม (Full Example)](#ตัวอย่างการใช้งานแบบเต็ม-full-example)

---

## คุณสมบัติเด่น (Features)
- 🔗 **รองรับลิงก์ YouTube หลากหลายรูปแบบ**: ลิงก์ Live (`/live/...`), ลิงก์ Watch (`/watch?v=...`), ลิงก์สั้น (`youtu.be`), ลิงก์ช่อง (`@channel/live`), หรือ Video ID 11 ตัว
- 💬 **ดึงคอมเมนต์ (Live Chat)**: ข้อความ, อีโมจิ (รวม Custom Emojis), ชื่อผู้ส่ง, รูปโปรไฟล์, ป้ายสถานะ (Owner, Moderator, Member, Verified)
- 🎁 **ดึงข้อมูลของขวัญ / การสนับสนุน (Monetization & Gifts)**:
  - **Super Chat**: ยอดเงิน, สกุลเงิน, ข้อความ, สีของแบนเนอร์
  - **Super Sticker**: รูปสติกเกอร์, ยอดเงิน, สกุลเงิน
  - **Memberships**: สมาชิกใหม่, การต่ออายุสมาชิก
  - **Gift Memberships**: การแจกของขวัญสมาชิกให้ผู้ชมในช่อง
- 👥 **ดึงจำนวนคนดูสด (Live Viewers)**: อัปเดตยอดคนดูสดและยอดไลก์ต่อเนื่องแบบ Real-time
- ⚡ **Zero External Dependencies**: สร้างด้วย Node.js มาตรฐาน ไม่ต้องติดตั้งแพ็กเกจภายนอกเพิ่ม ทำงานได้รวดเร็วและเบามาก
- 📘 **TypeScript Ready**: มี `index.d.ts` รองรับ Auto-complete ใน VS Code และ TypeScript ทันที

---

## การติดตั้ง (Installation)

```bash
npm install youtube-live-connector
```

*(หรือหากนำโปรเจกต์นี้ไปใส่ในโฟลเดอร์งาน สามารถเรียกใช้ได้ทันทีโดยไม่ต้อง install dependency เพิ่มเติม)*

---

## เริ่มต้นใช้งาน (Quick Start)

```javascript
const { YouTubeLiveConnector } = require('youtube-live-connector');

// สร้าง Connector โดยใส่ @username, ลิงก์ YouTube Live หรือ Video ID
// (ระบบจะค้นหาไลฟ์สตรีมที่กำลังออกอากาศสดอยู่ให้โดยอัตโนมัติ!)
const live = new YouTubeLiveConnector('@webder.nargor');

// 1. รับการแจ้งเตือนเมื่อเชื่อมต่อสำเร็จ
live.on('connected', (info) => {
  console.log(`เชื่อมต่อสำเร็จ: ${info.title} (คนดูสดเริ่มต้น: ${info.viewerCount})`);
});

// 2. ดึงคอมเมนต์แชทสด
live.on('chat', (data) => {
  console.log(`[แชท] ${data.author.name}: ${data.message}`);
});

// 3. ดึงของขวัญ (Super Chat, Super Sticker, Membership)
live.on('gift', (gift) => {
  if (gift.type === 'superchat') {
    console.log(`[Super Chat] ${gift.author.name} ส่ง ${gift.amountDisplay}: "${gift.message}"`);
  } else if (gift.type === 'supersticker') {
    console.log(`[Super Sticker] ${gift.author.name} ส่งสติกเกอร์มูลค่า ${gift.amountDisplay}`);
  } else if (gift.type === 'membership') {
    console.log(`[Membership] ${gift.author.name} สมัครสมาชิก: ${gift.headerText}`);
  } else if (gift.type === 'membership_gift') {
    console.log(`[Gift Memberships] ${gift.author.name} แจกสมาชิกจำนวน ${gift.giftCount} คน!`);
  }
});

// 4. ดักจับยอดไลก์ (Like) และจำนวนที่เพิ่มขึ้น
live.on('like', (data) => {
  console.log(`[ไลก์] รวม: ${data.likeCountDisplay} (+${data.likesIncrement})`);
});

// 5. ดักจับการกด Emoji Reactions (❤️, 😄, 🎉, 😳, 💯)
live.on('reaction', (data) => {
  console.log(`[Reaction] มีคนกด ${data.emoji} จำนวน ${data.count} ครั้ง!`);
});

// 6. ดักจับการสมัครสมาชิก / ติดตาม (Subscribe / Membership)
live.on('subscribe', (data) => {
  console.log(`[ผู้ติดตาม/สมาชิกใหม่] ${data.author ? data.author.name : 'มีคนสมัครสมาชิก/ติดตาม!'}`);
});

// 7. ดึงจำนวนคนดูสด (อัปเดตแบบเรียลไทม์)
live.on('viewers', (data) => {
  console.log(`[คนดูสด] ${data.viewerCount.toLocaleString()} คน (${data.viewerCountDisplay})`);
});

// เริ่มเชื่อมต่อ
live.connect().catch(console.error);
```

---

## รายการ Events ทั้งหมด (Events List)

### Event: `connected`
ส่งออกเมื่อเชื่อมต่อกับ YouTube Live สำเร็จ
```javascript
live.on('connected', (info) => {
  console.log(info.videoId);           // 'sgQT3zcN1u4'
  console.log(info.title);             // 'หัวข้อสตรีมสด'
  console.log(info.channelName);       // 'ชื่อช่อง'
  console.log(info.channelUrl);        // 'https://www.youtube.com/@...'
  console.log(info.viewerCount);       // จำนวนคนดูสด (ตัวเลข)
  console.log(info.viewerCountDisplay);// e.g. "3,188 watching now"
  console.log(info.url);               // URL ของสตรีม
});
```

### Event: `chat`
ส่งออกเมื่อมีคอมเมนต์/ข้อความใหม่เข้ามา
```javascript
live.on('chat', (chat) => {
  console.log(chat.id);                // Message ID
  console.log(chat.message);           // ข้อความธรรมดา (รวม emoji shortcut)
  console.log(chat.author.name);       // ชื่อผู้ส่ง
  console.log(chat.author.channelId);  // Channel ID ของผู้ส่ง
  console.log(chat.author.profilePictureUrl); // รูปโปรไฟล์
  console.log(chat.author.isOwner);    // เจ้าของช่องหรือไม่ (true/false)
  console.log(chat.author.isModerator);// แอดมิน/ผู้ดูแลหรือไม่ (true/false)
  console.log(chat.author.isMember);   // เป็นสมาชิกช่องหรือไม่ (true/false)
  console.log(chat.emojis);            // Array รายการอีโมจิในข้อความ
  console.log(chat.timestamp);         // Date object
});
```

### Event: `gift`
Event รวมสำหรับของขวัญ/การสนับสนุนทางการเงินทั้งหมด ประกอบด้วย 4 รูปแบบ:
1. `type: 'superchat'`:
   - `amount`: ตัวเลขจำนวนเงิน (เช่น `100`)
   - `currency`: สกุลเงิน (เช่น `฿`, `$`)
   - `amountDisplay`: ข้อความแสดงยอดเงิน (เช่น `"฿100.00"`)
   - `message`: ข้อความที่แนบมากับ Super Chat
   - `colors`: สีของแบนเนอร์ (headerBackgroundColor, bodyBackgroundColor)
2. `type: 'supersticker'`:
   - `amount`: จำนวนเงิน
   - `sticker.url`: URL รูปสติกเกอร์
   - `sticker.alt`: คำอธิบายสติกเกอร์
3. `type: 'membership'`:
   - `headerText`: e.g. `"Member for 6 months"`
   - `message`: ข้อความฉลองการเป็นสมาชิก
4. `type: 'membership_gift'`:
   - `giftCount`: จำนวนสมาชิกที่แจก (e.g. `5`)
   - `headerText`: e.g. `"Gifted 5 channel memberships"`
5. `type: 'jewels_gift'` (YouTube Jewels Gifts - ของขวัญแอนิเมชัน):
   - `giftName`: ชื่อของขวัญ (เช่น `"Hiding"`, `"Applause"`)
   - `actionText`: ข้อความการกระทำ (เช่น `"sent Hiding"`)
   - `giftImage.url`: รูปของขวัญความละเอียดสูง
   - `giftImage.alt`: คำอธิบายรูปของขวัญ

> 💡 **นอกจากนี้ยังสามารถแยกฟังเฉพาะ Event ย่อยได้ตามต้องการ**:
> - `live.on('jewelsGift', data => ...)` (ของขวัญ Jewels Gifts)
> - `live.on('superchat', data => ...)`
> - `live.on('supersticker', data => ...)`
> - `live.on('member', data => ...)`
> - `live.on('memberGift', data => ...)`

### Event: `viewers` (หรือ `roomUser`)
ส่งออกทุกครั้งที่จำนวนคนดูสดมีการเปลี่ยนแปลง (มี alias `roomUser` สำหรับห้องสตรีม)
```javascript
live.on('viewers', (data) => {
  console.log(data.viewerCount);        // 3125
  console.log(data.viewerCountDisplay); // "3,125 watching now"
  console.log(data.timestamp);          // Date object
});
```

### Event: `reaction` & `reactions` (Emoji Fountain)
ส่งออกเมื่อมีคนกด Floating Emoji Reactions ลอยขึ้นมาในสตรีม (เช่น ❤️, 😄, 🎉, 😳, 💯)
```javascript
// ดักจับรายอีโมจิ
live.on('reaction', (data) => {
  console.log(data.emoji);          // '❤️' หรือ '😄', '🎉', '😳', '💯'
  console.log(data.count);          // จำนวนครั้งที่กดในรอบนั้น (เช่น 3)
  console.log(data.totalReactions); // ยอดรวมทั้งหมดในชุดนั้น
  console.log(data.intensityScore); // ระดับความแรง (0.0 - 1.0)
  console.log(data.timestamp);      // Date object
});

// หรือดักจับเป็นชุด Batch
live.on('reactions', (batch) => {
  console.log(`มีคนกดรีแอ็กชันรวม ${batch.totalReactions} ครั้ง:`);
  for (const r of batch.reactions) {
    console.log(`- ${r.emoji}: ${r.count} ครั้ง`);
  }
});
```

### Event: `like`
ส่งออกเมื่อยอดกดไลก์ของสตรีมมีการอัปเดต พร้อมคำนวณจำนวนที่เพิ่มขึ้นให้อัตโนมัติ:
```javascript
live.on('like', (data) => {
  console.log(data.likeCount);        // ตัวเลขจำนวนไลก์ (เช่น 1200)
  console.log(data.likeCountDisplay); // ข้อความที่แสดงผล (เช่น "1.2K")
  console.log(data.likesIncrement);   // จำนวนไลก์ที่เพิ่มขึ้นจากรอบก่อนหน้า (เช่น 5)
  console.log(data.timestamp);        // Date object
});
```

### Event: `subscribe` (หรือ `follow`)
ส่งออกเมื่อมีผู้ติดตาม/สมัครสมาชิกเข้ามาใหม่ (Channel Membership หรือ Viewer Engagement Subscriber Notice):
```javascript
live.on('subscribe', (data) => {
  console.log(data.isMembership); // เป็นสมาชิกช่อง (true) หรือประกาศผู้ติดตาม (false)
  console.log(data.subType);      // 'membership' หรือ 'engagement_notice'
  if (data.author) {
    console.log(data.author.name);              // ชื่อผู้สมัคร
    console.log(data.author.profilePictureUrl);  // รูปโปรไฟล์
  }
});

// สามารถใช้ alias 'follow' ได้เช่นกัน
live.on('follow', (data) => { ... });
```

### Event: `engagement`
ส่งออกเมื่อมีประกาศข้อความ Engagement จากระบบของ YouTube ในไลฟ์แชท
```javascript
live.on('engagement', (data) => {
  console.log(data.message);           // ข้อความประกาศ
  console.log(data.isSubscribeNotice); // เป็นข้อความชวนติดตามหรือไม่ (true/false)
});
```

### Event อื่นๆ:
- `title`: เมื่อมีการเปลี่ยนชื่อไลฟ์สตรีม `{ title: string }`
- `streamEnded`: เมื่อสตรีมสดสิ้นสุดลง
- `disconnected`: เมื่อการเชื่อมต่อถูกตัด `{ reason: string }`
- `warning`: คำเตือน (เช่น ไลฟ์นี้ถูกปิดคอมเมนต์)
- `error`: ข้อผิดพลาดในการเชื่อมต่อ
- `raw`: รับข้อมูลดิบ InnerTube Action ทั้งหมดจาก YouTube

---

## รองรับ YouTube Username และ Link ทุกรูปแบบ

คุณสามารถส่ง `@username`, ชื่อช่อง หรือลิงก์ในรูปแบบใดก็ได้เข้าสู่ `YouTubeLiveConnector`:
```javascript
// 1. Channel Username / Handle (สะดวกที่สุด! ระบบค้นหาไลฟ์สดของช่องให้อัตโนมัติ)
new YouTubeLiveConnector('@webder.nargor');
new YouTubeLiveConnector('webder.nargor');
new YouTubeLiveConnector({ username: '@webder.nargor' });

// 2. Channel Live URL
new YouTubeLiveConnector('https://www.youtube.com/@webder.nargor/live');
new YouTubeLiveConnector('https://www.youtube.com/@webder.nargor');

// 3. Standard Watch URL
new YouTubeLiveConnector('https://www.youtube.com/watch?v=sgQT3zcN1u4');

// 4. YouTube Live URL
new YouTubeLiveConnector('https://www.youtube.com/live/sgQT3zcN1u4');

// 5. Short URL
new YouTubeLiveConnector('https://youtu.be/sgQT3zcN1u4');

// 6. Raw Video ID 11 ตัว
new YouTubeLiveConnector('sgQT3zcN1u4');
```

---

## ตัวเลือกการตั้งค่า (Options)

```javascript
const live = new YouTubeLiveConnector({
  url: 'https://www.youtube.com/watch?v=sgQT3zcN1u4',
  pollViewers: true,          // เปิด/ปิด การวนอ่านจำนวนคนดูสด (default: true)
  viewerIntervalMs: 5000,     // ความถี่ในการอัปเดตคนดูสด (default: 5000 ms)
  chatIntervalMs: 2000,       // กำหนดความถี่อ่านแชท (ถ้าไม่กำหนดจะใช้ตามที่ YouTube แนะนำ)
  ignoreInitialChat: false,   // ข้ามแชทเก่าที่มีอยู่ก่อนหน้าบนหน้าจอหรือไม่ (default: false)
  headers: { ... }            // ปรับแต่ง HTTP headers เพิ่มเติม (ถ้ามี)
});
```

---

## ตัวอย่างการใช้งานแบบเต็ม (Full Example)

สามารถรันตัวอย่างที่เตรียมไว้ได้ทันที:

```bash
# รันตัวอย่างพื้นฐาน
npm run example:basic

# รันตัวอย่างแบบดักฟังทุก Event พร้อมแสดงข้อความแบบจัดเต็ม
node examples/full-listener.js https://www.youtube.com/watch?v=YOUR_LIVE_ID
```

---

## License

MIT License
