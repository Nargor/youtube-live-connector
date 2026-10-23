'use strict';

const { extractRunText, parseViewerCount, determineLiveStatus } = require('../utils/helpers');

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

  const videoDetails = ytInitialData.playerResponse?.videoDetails;
  if (videoDetails) {
    result.title = videoDetails.title || '';
    result.channelName = videoDetails.author || '';
    result.channelId = videoDetails.channelId || '';
    result.isLive = !!videoDetails.isLive;
  }

  const primaryContents = ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents;
  if (Array.isArray(primaryContents)) {
    for (const item of primaryContents) {
      if (item.videoPrimaryInfoRenderer) {
        const p = item.videoPrimaryInfoRenderer;

        if (!result.title && p.title) {
          result.title = extractRunText(p.title).text;
        }

        const vcRenderer = p.viewCount?.videoViewCountRenderer;
        if (vcRenderer?.viewCount) {
          const vc = vcRenderer.viewCount;
          result.viewerCountDisplay = vc.runs ? vc.runs.map(r => r.text).join('') : (vc.simpleText || '');
          result.viewerCount = parseViewerCount(result.viewerCountDisplay);
          const liveStatus = determineLiveStatus(vcRenderer, result.viewerCountDisplay);
          if (liveStatus !== null) result.isLive = liveStatus;
        }

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

        if (p.updatedMetadataEndpoint) {
          result.updatedMetadataEndpoint = p.updatedMetadataEndpoint;
        }
      }

      if (item.videoSecondaryInfoRenderer) {
        const owner = item.videoSecondaryInfoRenderer.owner?.videoOwnerRenderer;
        if (owner) {
          if (!result.channelName && owner.title) result.channelName = extractRunText(owner.title).text;
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
 * @returns {{ viewerCount?: number, viewerCountDisplay?: string, isLive?: boolean, title?: string, likeCount?: number, likeCountDisplay?: string, streamEndedDateText?: string, dateText?: string }}
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

        const liveStatus = determineLiveStatus(vcRenderer, display);
        if (liveStatus !== null) updates.isLive = liveStatus;
      }
    }

    if (a.updateTitleAction) {
      updates.title = extractRunText(a.updateTitleAction.title).text;
    }

    if (a.updateToggleMenuServiceItemAction?.defaultText) {
      const text = extractRunText(a.updateToggleMenuServiceItemAction.defaultText).text;
      updates.likeCountDisplay = text;
      updates.likeCount = parseViewerCount(text);
    }

    if (a.updateDateTextAction) {
      const dateText = a.updateDateTextAction.dateText;
      const rawDateText = dateText ? (dateText.simpleText || extractRunText(dateText).text || '') : '';
      updates.dateText = rawDateText;

      const isPastStream = /streamed\s+live|สตรีมสดเมื่อ/i.test(rawDateText) ||
                           (/streamed/i.test(rawDateText) && !/started/i.test(rawDateText));

      if (isPastStream) {
        if (updates.isLive !== true) updates.isLive = false;
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
