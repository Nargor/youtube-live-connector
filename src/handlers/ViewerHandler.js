'use strict';

const BaseHandler = require('./BaseHandler');

/**
 * ViewerHandler
 * Handles live viewer count tracking (events: 'viewers', 'roomUser')
 */
class ViewerHandler extends BaseHandler {
  /**
   * Emit viewer count and alias event 'roomUser'
   * @param {number} viewerCount
   * @param {string} viewerCountDisplay
   */
  emitViewers(viewerCount, viewerCountDisplay) {
    const data = {
      viewerCount,
      viewerCountDisplay,
      timestamp: new Date()
    };
    this.emit('viewers', data);
    this.emit('roomUser', data);
  }

  /**
   * Handle initial viewer count discovered on connection
   * @param {number} viewerCount
   * @param {string} viewerCountDisplay
   */
  initialize(viewerCount, viewerCountDisplay) {
    if (viewerCount > 0) {
      this.emitViewers(viewerCount, viewerCountDisplay);
    }
  }

  /**
   * Handle metadata updates from updated_metadata polling
   * @param {object} updates
   * @param {object} context
   */
  handleMetadata(updates, context = {}) {
    if (updates.viewerCount !== undefined) {
      if (this.connector.streamInfo) {
        this.connector.streamInfo.viewerCount = updates.viewerCount;
        this.connector.streamInfo.viewerCountDisplay = updates.viewerCountDisplay;
      }
      this.emitViewers(updates.viewerCount, updates.viewerCountDisplay);
    }
  }
}

module.exports = ViewerHandler;
