'use strict';

const https = require('https');
const { extractJsonFromHtml } = require('../utils/helpers');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
};

function extractContinuation(cont) {
  const data = cont?.invalidationContinuationData || cont?.timedContinuationData || cont?.reloadContinuationData;
  return data ? { continuation: data.continuation, timeoutMs: data.timeoutMs || 3000 } : null;
}

class InnertubeService {
  /**
   * @param {object} [options]
   * @param {object} [options.headers]
   * @param {string} [options.clientVersion]
   */
  constructor(options = {}) {
    this.customHeaders = options.headers || {};
    this.clientVersion = options.clientVersion || '2.20260918.00.00';
    this.apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  }

  /**
   * Send HTTP GET request
   * @param {string} url 
   * @returns {Promise<string>}
   */
  get(url) {
    return new Promise((resolve, reject) => {
      const headers = { ...DEFAULT_HEADERS, ...this.customHeaders };

      https.get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location;
          if (loc.startsWith('/')) loc = `https://www.youtube.com${loc}`;
          return resolve(this.get(loc));
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Send JSON POST request to InnerTube API endpoint
   * @param {string} url 
   * @param {object} body 
   * @returns {Promise<object>}
   */
  post(url, body) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const parsedUrl = new URL(url);

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...DEFAULT_HEADERS,
        ...this.customHeaders
      };

      const req = https.request({
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseBody));
          } catch (err) {
            reject(new Error(`Failed to parse InnerTube JSON response: ${err.message}`));
          }
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Extract API Key & Client Version from page HTML
   * @private
   */
  _extractConfig(html) {
    const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    if (keyMatch) this.apiKey = keyMatch[1];
    const verMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/);
    if (verMatch) this.clientVersion = verMatch[1];
  }

  /**
   * Fetch watch page to extract stream info, API key, and initial viewer info
   * @param {string} videoId 
   * @returns {Promise<{ ytInitialData: object|null, apiKey: string, clientVersion: string }>}
   */
  async fetchWatchPage(videoId) {
    const html = await this.get(`https://www.youtube.com/watch?v=${videoId}`);
    this._extractConfig(html);
    return {
      ytInitialData: extractJsonFromHtml(html, 'ytInitialData'),
      apiKey: this.apiKey,
      clientVersion: this.clientVersion
    };
  }

  /**
   * Fetch live chat page to extract initial chat continuation token and chat messages
   * @param {string} videoId 
   * @returns {Promise<{ liveChatRenderer: object|null, continuation: string|null, timeoutMs: number, isDisabled: boolean, frameworkUpdates?: object }>}
   */
  async fetchLiveChatPage(videoId) {
    const html = await this.get(`https://www.youtube.com/live_chat?v=${videoId}`);
    this._extractConfig(html);
    const ytInitialData = extractJsonFromHtml(html, 'ytInitialData');

    const disabledMsg = ytInitialData?.contents?.messageRenderer?.text?.runs?.[0]?.text;
    if (disabledMsg && disabledMsg.toLowerCase().includes('chat is disabled')) {
      return { liveChatRenderer: null, continuation: null, timeoutMs: 10000, isDisabled: true };
    }

    const liveChatRenderer = ytInitialData?.contents?.liveChatRenderer;
    const contInfo = extractContinuation(liveChatRenderer?.continuations?.[0]);

    return {
      liveChatRenderer,
      continuation: contInfo?.continuation || null,
      timeoutMs: contInfo?.timeoutMs || 3000,
      isDisabled: false,
      frameworkUpdates: ytInitialData?.frameworkUpdates || null
    };
  }

  /**
   * Fetch live chat messages continuation from Innertube API
   * @param {string} continuationToken 
   * @returns {Promise<{ actions: Array, nextContinuation: string|null, timeoutMs: number, frameworkUpdates?: object }>}
   */
  async fetchLiveChatContinuation(continuationToken) {
    const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${this.apiKey}`;
    const payload = {
      context: { client: { clientName: 'WEB', clientVersion: this.clientVersion, hl: 'en' } },
      continuation: continuationToken
    };

    const res = await this.post(url, payload);
    const lcc = res.continuationContents?.liveChatContinuation;
    const contInfo = extractContinuation(lcc?.continuations?.[0]);

    return {
      actions: lcc?.actions || [],
      nextContinuation: contInfo?.continuation || null,
      timeoutMs: contInfo?.timeoutMs || 3000,
      frameworkUpdates: res.frameworkUpdates || null
    };
  }

  /**
   * Fetch updated metadata (real-time live viewers, likes, title)
   * @param {string} videoId 
   * @param {string} [continuationToken]
   * @returns {Promise<{ actions: Array, nextContinuation: string|null, timeoutMs: number }>}
   */
  async fetchUpdatedMetadata(videoId, continuationToken = null) {
    const url = `https://www.youtube.com/youtubei/v1/updated_metadata?key=${this.apiKey}`;
    const payload = {
      context: { client: { clientName: 'WEB', clientVersion: this.clientVersion, hl: 'en' } }
    };

    if (continuationToken) {
      payload.continuation = continuationToken;
    } else {
      payload.videoId = videoId;
      payload.params = 'IAA=';
    }

    const res = await this.post(url, payload);
    const cont = res.continuation?.timedContinuationData;

    return {
      actions: res.actions || [],
      nextContinuation: cont?.continuation || null,
      timeoutMs: cont?.timeoutMs || 5000
    };
  }
}

module.exports = InnertubeService;
