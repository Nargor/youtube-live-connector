'use strict';

/**
 * Robustly extract a JSON object assigned to a key in an HTML document.
 * e.g. `window["ytInitialData"] = { ... };` or `var ytInitialData = { ... };`
 * @param {string} html 
 * @param {string} key 
 * @returns {object|null}
 */
function extractJsonFromHtml(html, key) {
  if (!html || !key) return null;
  const startIdx = html.indexOf(key);
  if (startIdx === -1) return null;

  const equalsIdx = html.indexOf('=', startIdx);
  if (equalsIdx === -1) return null;

  let jsonStart = equalsIdx + 1;
  while (html[jsonStart] === ' ' || html[jsonStart] === '\n' || html[jsonStart] === '\r' || html[jsonStart] === '\t') {
    jsonStart++;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(jsonStart, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract plain text and emoji list from a YouTube runs object
 * @param {object|string} runsObj 
 * @returns {{ text: string, emojis: Array }}
 */
function extractRunText(runsObj) {
  if (!runsObj) return { text: '', emojis: [] };
  if (typeof runsObj === 'string') return { text: runsObj, emojis: [] };
  if (runsObj.simpleText) return { text: runsObj.simpleText, emojis: [] };

  const runs = runsObj.runs;
  if (!Array.isArray(runs)) return { text: '', emojis: [] };

  let text = '';
  const emojis = [];

  for (const r of runs) {
    if (r.text) {
      text += r.text;
    } else if (r.emoji) {
      const emoji = r.emoji;
      const emojiShortcut = emoji.shortcuts?.[0] || emoji.searchTerms?.[0] || '';
      const emojiUrl = getLastThumbnail(emoji.image?.thumbnails);
      text += emojiShortcut || (emoji.isCustomEmoji ? '[custom emoji]' : ' ');
      emojis.push({
        emojiId: emoji.emojiId || '',
        name: emojiShortcut,
        isCustom: !!emoji.isCustomEmoji,
        url: emojiUrl
      });
    }
  }

  return { text, emojis };
}

/**
 * Parse viewer count string to integer number
 * e.g. "4,532 watching now" -> 4532, "1.2M watching now" -> 1200000, "25K watching now" -> 25000
 * @param {string|number} str 
 * @returns {number}
 */
function parseViewerCount(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;

  const match = str.match(/([\d.,]+)\s*([kKmMbB]?)/);
  if (!match) return 0;

  let num = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;

  const mult = { K: 1e3, M: 1e6, B: 1e9 }[match[2].toUpperCase()] || 1;
  return Math.round(num * mult);
}

/**
 * Parse currency and numeric value from purchase amount text
 * e.g. "$5.00" -> { amount: 5.00, currency: "$", raw: "$5.00" }
 * @param {string} text 
 * @returns {{ amount: number, currency: string, raw: string }}
 */
function parsePrice(text) {
  if (!text || typeof text !== 'string') return { amount: 0, currency: '', raw: '' };

  const clean = text.trim();
  const currency = clean.match(/^([^\d\s]+)/)?.[1] || '';

  let numStr = clean.replace(/^[^\d]+/, '').replace(/[^\d.,]/g, '');
  numStr = (numStr.includes(',') && !numStr.includes('.')) ? numStr.replace(',', '.') : numStr.replace(/,/g, '');

  return { amount: parseFloat(numStr) || 0, currency, raw: clean };
}

/**
 * Parse badges (Moderator, Channel Owner, Member, Verified)
 * @param {Array} authorBadges 
 * @returns {{ isOwner: boolean, isModerator: boolean, isMember: boolean, isVerified: boolean, badges: Array }}
 */
function parseBadges(authorBadges) {
  const result = { isOwner: false, isModerator: false, isMember: false, isVerified: false, badges: [] };
  if (!Array.isArray(authorBadges)) return result;

  for (const b of authorBadges) {
    const r = b.liveChatAuthorBadgeRenderer;
    if (!r) continue;

    const label = r.tooltip || r.accessibility?.accessibilityData?.label || '';
    const iconType = r.icon?.iconType || '';
    const iconUrl = r.customThumbnail?.thumbnails?.[0]?.url || '';
    result.badges.push({ label, iconType, iconUrl });

    const lower = label.toLowerCase();
    if (iconType === 'OWNER' || lower.includes('owner')) result.isOwner = true;
    else if (iconType === 'MODERATOR' || lower.includes('moderator')) result.isModerator = true;
    else if (iconType === 'VERIFIED' || lower.includes('verified')) result.isVerified = true;
    else if (r.customThumbnail || lower.includes('member') || lower.includes('sponsor')) result.isMember = true;
  }

  return result;
}

/**
 * Get highest resolution / last thumbnail URL from an array of thumbnails
 * @param {Array} thumbnails 
 * @returns {string}
 */
function getLastThumbnail(thumbnails) {
  return Array.isArray(thumbnails) && thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url || '' : '';
}

/**
 * Parse microsecond timestamp to Date and numeric timestampUsec
 * @param {string|number} usec 
 * @returns {{ timestampUsec: number, timestamp: Date }}
 */
function parseTimestamp(usec) {
  const timestampUsec = usec ? parseInt(usec, 10) : Date.now() * 1000;
  return { timestampUsec, timestamp: new Date(Math.floor(timestampUsec / 1000)) };
}

/**
 * Convert integer color to hex string e.g. 4286267099 -> #ffaabb
 * @param {number|null} colorInt 
 * @returns {string|null}
 */
function toHexColor(colorInt) {
  return colorInt != null ? `#${colorInt.toString(16).padStart(6, '0')}` : null;
}

/**
 * Parse standard author object from a YouTube renderer
 * @param {object} renderer 
 * @param {boolean} [defaultIsMember=false]
 * @returns {object}
 */
function parseAuthor(renderer, defaultIsMember = false) {
  const badgeInfo = parseBadges(renderer?.authorBadges);
  return {
    name: renderer?.authorName?.simpleText || '',
    channelId: renderer?.authorExternalChannelId || '',
    profilePictureUrl: getLastThumbnail(renderer?.authorPhoto?.thumbnails),
    isOwner: badgeInfo.isOwner,
    isModerator: badgeInfo.isModerator,
    isMember: defaultIsMember || badgeInfo.isMember,
    isVerified: badgeInfo.isVerified,
    badges: badgeInfo.badges
  };
}

/**
 * Determine if stream is live or ended based on vcRenderer and display text
 * @param {object} vcRenderer 
 * @param {string} display 
 * @returns {boolean|null} true = live, false = ended, null = undetermined
 */
function determineLiveStatus(vcRenderer, display) {
  if (!vcRenderer) return null;
  const isWatching = /watching|waiting|คนกำลังดู|กำลังรอ/i.test(display);
  if (vcRenderer.isLive === true || isWatching) return true;
  if (vcRenderer.isLive === false || (/views|ครั้ง/i.test(display) && !isWatching)) return false;
  return null;
}

module.exports = {
  extractJsonFromHtml,
  extractRunText,
  parseViewerCount,
  parsePrice,
  parseBadges,
  getLastThumbnail,
  parseTimestamp,
  toHexColor,
  parseAuthor,
  determineLiveStatus
};
