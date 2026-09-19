'use strict';

const https = require('https');

/**
 * Extract YouTube video ID synchronously if pattern is standard
 * @param {string} input 
 * @returns {string|null}
 */
function extractVideoIdSync(input) {
  if (!input || typeof input !== 'string') return null;
  input = input.trim();

  // Raw 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);

    // https://www.youtube.com/watch?v=...
    if (url.searchParams.has('v')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    }

    const pathname = url.pathname;
    const parts = pathname.split('/').filter(Boolean);

    // https://youtu.be/...
    if (url.hostname.includes('youtu.be') && parts.length > 0) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(parts[0])) return parts[0];
    }

    // https://www.youtube.com/live/... or /embed/... or /v/...
    if (parts.length >= 2 && (parts[0] === 'live' || parts[0] === 'embed' || parts[0] === 'v')) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(parts[1])) return parts[1];
    }
  } catch (e) {
    // Not a valid URL string
  }

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
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers
    };

    https.get(url, { headers: defaultHeaders }, (res) => {
      // Follow 301, 302, 303, 307, 308 redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `https://www.youtube.com${redirectUrl}`;
        }
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
 * Resolve any YouTube Live link (including channel handles @handle/live) to a video ID
 * @param {string} input 
 * @param {object} [options]
 * @returns {Promise<{ videoId: string, finalUrl: string }>}
 */
async function resolveVideoId(input, options = {}) {
  const syncId = extractVideoIdSync(input);
  if (syncId) {
    return { videoId: syncId, finalUrl: `https://www.youtube.com/watch?v=${syncId}` };
  }

  // If not resolved synchronously, it might be a channel live link:
  // e.g. https://www.youtube.com/@channelName/live or https://www.youtube.com/channel/UC.../live
  let targetUrl = input.trim();
  if (targetUrl.startsWith('@')) {
    targetUrl = `https://www.youtube.com/${targetUrl}/live`;
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://www.youtube.com/${targetUrl}`;
  }

  const { html, finalUrl } = await fetchHtmlWithRedirects(targetUrl, options.headers);

  // Check if finalUrl already contains a videoId
  const finalId = extractVideoIdSync(finalUrl);
  if (finalId) {
    return { videoId: finalId, finalUrl };
  }

  // Look for canonical URL in HTML
  const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})">/);
  if (canonicalMatch) {
    return { videoId: canonicalMatch[1], finalUrl: `https://www.youtube.com/watch?v=${canonicalMatch[1]}` };
  }

  // Look for videoId in page JSON data
  const vidMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (vidMatch) {
    return { videoId: vidMatch[1], finalUrl: `https://www.youtube.com/watch?v=${vidMatch[1]}` };
  }

  throw new Error(`Could not resolve YouTube Live Video ID from: "${input}". Ensure the stream is currently live.`);
}

module.exports = {
  extractVideoIdSync,
  fetchHtmlWithRedirects,
  resolveVideoId
};
