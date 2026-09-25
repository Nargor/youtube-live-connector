'use strict';

const { extractRunText, parseViewerCount } = require('../utils/helpers');

/**
 * Parse stream metadata from initial ytInitialData on watch page
 * @param {object} ytInitialData 
 * @param {string} videoId 
 * @returns {object}
 */
function parseInitialStreamInfo(ytInitialData, videoId) {
  const result = {
    videoId,
    title: '',
    channelName: '',
    channelId: '',
    channelUrl: '',
    viewerCount: 0,
    viewerCountDisplay: '',
    likeCount: 0,
    likeCountDisplay: '',
    isLive: false,
    updatedMetadataEndpoint: null
  };

  if (!ytInitialData) return result;

  // Video details from player response or initial data
  const videoDetails = ytInitialData.playerResponse?.videoDetails;
  if (videoDetails) {
    result.title = videoDetails.title || '';
    result.channelName = videoDetails.author || '';
    result.channelId = videoDetails.channelId || '';
    result.isLive = !!videoDetails.isLive;
  }

  // Primary info renderer
  const primaryContents = ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents;
  if (Array.isArray(primaryContents)) {
    for (const item of primaryContents) {
      if (item.videoPrimaryInfoRenderer) {
        const p = item.videoPrimaryInfoRenderer;

        // Title
        if (!result.title && p.title) {
          result.title = extractRunText(p.title).text;
        }

        // View count
        const vcRenderer = p.viewCount?.videoViewCountRenderer;
        if (vcRenderer?.viewCount) {
          const vc = vcRenderer.viewCount;
          result.viewerCountDisplay = vc.runs ? vc.runs.map(r => r.text).join('') : (vc.simpleText || '');
          result.viewerCount = parseViewerCount(result.viewerCountDisplay);
          const isWatching = /watching|waiting|คนกำลังดู|กำลังรอ/i.test(result.viewerCountDisplay);
          if (vcRenderer.isLive === true || isWatching) {
            result.isLive = true;
          } else if (vcRenderer.isLive === false || (/views|ครั้ง/i.test(result.viewerCountDisplay) && !isWatching)) {
            result.isLive = false;
          }
        }

        // Like count from primary info buttons
        const topButtons = p.videoActions?.menuRenderer?.topLevelButtons;
        if (Array.isArray(topButtons)) {
          for (const btn of topButtons) {
            const toggle = btn.segmentedLikeDislikeButtonRenderer?.likeButton?.toggleButtonRenderer ||
                           btn.likeButtonRenderer?.likeButton?.toggleButtonRenderer ||
                           btn.toggleButtonRenderer;
            if (toggle?.defaultText) {
              const text = extractRunText(toggle.defaultText).text;
              if (text) {
                result.likeCountDisplay = text;
                result.likeCount = parseViewerCount(text);
                break;
              }
            }
          }
        }

        // Updated metadata endpoint (used for polling live viewers)
        if (p.updatedMetadataEndpoint) {
          result.updatedMetadataEndpoint = p.updatedMetadataEndpoint;
        }
      }

      if (item.videoSecondaryInfoRenderer) {
        const s = item.videoSecondaryInfoRenderer;
        const owner = s.owner?.videoOwnerRenderer;
        if (owner) {
          if (!result.channelName && owner.title) {
            result.channelName = extractRunText(owner.title).text;
          }
          if (owner.navigationEndpoint?.browseEndpoint?.browseId) {
            result.channelId = owner.navigationEndpoint.browseEndpoint.browseId;
          }
          if (owner.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) {
            result.channelUrl = `https://www.youtube.com${owner.navigationEndpoint.browseEndpoint.canonicalBaseUrl}`;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Parse updated_metadata actions from YouTube InnerTube
 * @param {Array} actions 
 * @returns {{ viewerCount?: number, viewerCountDisplay?: string, isLive?: boolean, title?: string, likeCount?: number, likeCountDisplay?: string }}
 */
function parseUpdatedMetadataActions(actions) {
  const updates = {};
  if (!Array.isArray(actions)) return updates;

  for (const a of actions) {
    if (a.updateViewershipAction) {
      const vcRenderer = a.updateViewershipAction.viewCount?.videoViewCountRenderer;
      if (vcRenderer) {
        const vc = vcRenderer.viewCount;
        const display = vc?.runs ? vc.runs.map(r => r.text).join('') : (vc?.simpleText || '');
        updates.viewerCountDisplay = display;
        updates.viewerCount = parseViewerCount(display);

        const isWatching = /watching|waiting|คนกำลังดู|กำลังรอ/i.test(display);
        if (vcRenderer.isLive === true || isWatching) {
          updates.isLive = true;
        } else if (vcRenderer.isLive === false || (/views|ครั้ง/i.test(display) && !isWatching)) {
          updates.isLive = false;
        }
      }
    }

    if (a.updateTitleAction) {
      const titleRuns = a.updateTitleAction.title;
      updates.title = extractRunText(titleRuns).text;
    }

    if (a.updateToggleMenuServiceItemAction) {
      const defaultText = a.updateToggleMenuServiceItemAction.defaultText;
      if (defaultText) {
        const text = extractRunText(defaultText).text;
        updates.likeCountDisplay = text;
        updates.likeCount = parseViewerCount(text);
      }
    }

    // updateDateTextAction appears on active ("Started streaming...") and ended ("Streamed live on...") streams
    if (a.updateDateTextAction) {
      const dateText = a.updateDateTextAction.dateText;
      const rawDateText = dateText ? (dateText.simpleText || extractRunText(dateText).text || '') : '';
      updates.dateText = rawDateText;

      const isPastStream = /streamed\s+live|สตรีมสดเมื่อ/i.test(rawDateText) ||
                           (/streamed/i.test(rawDateText) && !/started/i.test(rawDateText));

      if (isPastStream) {
        // Only mark ended if updates.isLive is not already confirmed true by watching/waiting
        if (updates.isLive !== true) {
          updates.isLive = false;
        }
        updates.streamEndedDateText = rawDateText;
      }
    }
  }

  return updates;
}

module.exports = {
  parseInitialStreamInfo,
  parseUpdatedMetadataActions
};
