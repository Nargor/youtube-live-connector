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
          const jsonStr = html.slice(jsonStart, i + 1);
          try {
            return JSON.parse(jsonStr);
          } catch (e) {
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
 * @param {object} runsObj 
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
      const emojiUrl = emoji.image?.thumbnails?.[emoji.image.thumbnails.length - 1]?.url || '';
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
 * e.g. "4,532 watching now" -> 4532
 * "1.2M watching now" -> 1200000
 * "25K watching now" -> 25000
 * @param {string} str 
 * @returns {number}
 */
function parseViewerCount(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;

  // Extract the numeric portion before "watching", "views", etc.
  const match = str.match(/([\d.,]+)\s*([kKmMbB]?)/);
  if (!match) return 0;

  const rawNum = match[1].replace(/,/g, '');
  let num = parseFloat(rawNum);
  if (isNaN(num)) return 0;

  const multiplier = match[2].toUpperCase();
  if (multiplier === 'K') num *= 1_000;
  else if (multiplier === 'M') num *= 1_000_000;
  else if (multiplier === 'B') num *= 1_000_000_000;

  return Math.round(num);
}

/**
 * Parse currency and numeric value from purchase amount text
 * e.g. "$5.00" -> { amount: 5.00, currency: "$", raw: "$5.00" }
 * "฿100.00" -> { amount: 100.00, currency: "฿", raw: "฿100.00" }
 * "€10,50" -> { amount: 10.50, currency: "€", raw: "€10,50" }
 * @param {string} text 
 * @returns {{ amount: number, currency: string, raw: string }}
 */
function parsePrice(text) {
  if (!text || typeof text !== 'string') {
    return { amount: 0, currency: '', raw: '' };
  }

  const clean = text.trim();
  const currencyMatch = clean.match(/^([^\d\s]+)/);
  const currency = currencyMatch ? currencyMatch[1] : '';

  // Extract number (handle both dot and comma as decimal separator)
  let numStr = clean.replace(/^[^\d]+/, '').replace(/[^\d.,]/g, '');
  if (numStr.includes(',') && !numStr.includes('.')) {
    numStr = numStr.replace(',', '.');
  } else {
    numStr = numStr.replace(/,/g, '');
  }

  const amount = parseFloat(numStr) || 0;
  return { amount, currency, raw: clean };
}

/**
 * Parse badges (Moderator, Channel Owner, Member, Verified)
 * @param {Array} authorBadges 
 * @returns {{ isOwner: boolean, isModerator: boolean, isMember: boolean, isVerified: boolean, badges: Array }}
 */
function parseBadges(authorBadges) {
  const result = {
    isOwner: false,
    isModerator: false,
    isMember: false,
    isVerified: false,
    badges: []
  };

  if (!Array.isArray(authorBadges)) return result;

  for (const b of authorBadges) {
    const renderer = b.liveChatAuthorBadgeRenderer;
    if (!renderer) continue;

    const label = renderer.tooltip || renderer.accessibility?.accessibilityData?.label || '';
    const iconType = renderer.icon?.iconType || '';
    const iconUrl = renderer.customThumbnail?.thumbnails?.[0]?.url || '';

    const badgeInfo = { label, iconType, iconUrl };
    result.badges.push(badgeInfo);

    const lower = label.toLowerCase();
    if (iconType === 'OWNER' || lower.includes('owner')) {
      result.isOwner = true;
    } else if (iconType === 'MODERATOR' || lower.includes('moderator')) {
      result.isModerator = true;
    } else if (iconType === 'VERIFIED' || lower.includes('verified')) {
      result.isVerified = true;
    } else if (renderer.customThumbnail || lower.includes('member') || lower.includes('sponsor')) {
      result.isMember = true;
    }
  }

  return result;
}

module.exports = {
  extractJsonFromHtml,
  extractRunText,
  parseViewerCount,
  parsePrice,
  parseBadges
};
