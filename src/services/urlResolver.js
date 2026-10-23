'use strict';

const https = require('https');

const ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract YouTube video ID synchronously if pattern is standard
 * @param {string} input 
 * @returns {string|null}
 */
function extractVideoIdSync(input) {
  if (!input || typeof input !== 'string') return null;
  input = input.trim();

  if (ID_REGEX.test(input)) return input;

  try {
    const url = new URL(input);
    const v = url.searchParams.get('v');
    if (v && ID_REGEX.test(v)) return v;

    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname.includes('youtu.be') && parts[0] && ID_REGEX.test(parts[0])) return parts[0];
    if (parts.length >= 2 && ['live', 'embed', 'v'].includes(parts[0]) && ID_REGEX.test(parts[1])) return parts[1];
  } catch {}

  return null;
}

/**
 * Fetch a URL following redirects and return final response & body
 * @param {string} url 
 * @param {object} headers 
 * @param {number} maxRedirects 
 * @returns {Promise<{ html: string, finalUrl: string }>}
 */
function fetchHtmlWithRedirects(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers
    };

    https.get(url, { headers: defaultHeaders }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = `https://www.youtube.com${redirectUrl}`;
        return resolve(fetchHtmlWithRedirects(redirectUrl, headers, maxRedirects - 1));
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ html: data, finalUrl: url }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Resolve any YouTube Live link to a video ID
 * @param {string} input 
 * @param {object} [options]
 * @returns {Promise<{ videoId: string, finalUrl: string }>}
 */
async function resolveVideoId(input, options = {}) {
  if (!input || typeof input !== 'string') {
    throw new Error('No YouTube URL, Video ID, or Channel Username provided.');
  }

  const syncId = extractVideoIdSync(input);
  if (syncId) {
    return { videoId: syncId, finalUrl: `https://www.youtube.com/watch?v=${syncId}` };
  }

  let targetUrl = input.trim();
  if (targetUrl.startsWith('@')) {
    targetUrl = `https://www.youtube.com/${targetUrl.replace(/\/live\/?$/, '')}/live`;
  } else if (!/^https?:\/\//i.test(targetUrl)) {
    if (/^(?:www\.)?youtube\.com/i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    } else if (/^(?:channel|c|user)\//i.test(targetUrl)) {
      targetUrl = `https://www.youtube.com/${targetUrl.replace(/\/live\/?$/, '')}/live`;
    } else {
      targetUrl = `https://www.youtube.com/@${targetUrl.replace(/\/live\/?$/, '')}/live`;
    }
  }

  // Ensure channel URLs point to /live
  const channelMatch = targetUrl.match(/^https?:\/\/(?:www\.)?youtube\.com\/(@[^/?#]+)(?:\/live)?/i);
  if (channelMatch) {
    targetUrl = `https://www.youtube.com/${channelMatch[1]}/live`;
  }

  const { html, finalUrl } = await fetchHtmlWithRedirects(targetUrl, options.headers);

  // 1. Check if redirect URL contains video ID
  const finalId = extractVideoIdSync(finalUrl);
  if (finalId) {
    return { videoId: finalId, finalUrl: `https://www.youtube.com/watch?v=${finalId}` };
  }

  // 2. Extract video ID from canonical, meta, or JSON data
  const match = html.match(/(?:<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=|<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=|<link itemprop="url" href="https:\/\/www\.youtube\.com\/watch\?v=|"videoId":")([a-zA-Z0-9_-]{11})/);
  if (match) {
    return { videoId: match[1], finalUrl: `https://www.youtube.com/watch?v=${match[1]}` };
  }

  throw new Error(`Could not resolve YouTube Live Video ID from: "${input}". Ensure the channel is currently live.`);
}

module.exports = {
  extractVideoIdSync,
  fetchHtmlWithRedirects,
  resolveVideoId
};
