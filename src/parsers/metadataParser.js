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
    likeCount: '',
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
    result.isLive = !!videoDetails.isLiveContent || !!videoDetails.isLive;
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
        const vc = p.viewCount?.videoViewCountRenderer?.viewCount;
        if (vc) {
          result.viewerCountDisplay = vc.runs ? vc.runs.map(r => r.text).join('') : (vc.simpleText || '');
          result.viewerCount = parseViewerCount(result.viewerCountDisplay);
          result.isLive = true;
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
 * @returns {{ viewerCount?: number, viewerCountDisplay?: string, isLive?: boolean, title?: string, likeCount?: string }}
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
        updates.isLive = vcRenderer.isLive !== false;
      }
    }

    if (a.updateTitleAction) {
      const titleRuns = a.updateTitleAction.title;
      updates.title = extractRunText(titleRuns).text;
    }

    if (a.updateToggleMenuServiceItemAction) {
      const defaultText = a.updateToggleMenuServiceItemAction.defaultText;
      if (defaultText) {
        updates.likeCount = extractRunText(defaultText).text;
      }
    }
  }

  return updates;
}

module.exports = {
  parseInitialStreamInfo,
  parseUpdatedMetadataActions
};
