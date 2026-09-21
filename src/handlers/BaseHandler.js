'use strict';

/**
 * BaseHandler
 * Abstract base class for all event/feature handlers
 */
class BaseHandler {
  /**
   * @param {import('../YouTubeLiveConnector')} connector
   */
  constructor(connector) {
    if (!connector) {
      throw new Error('BaseHandler requires a connector instance.');
    }
    this.connector = connector;
  }

  /**
   * Emit an event through the connector
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    return this.connector.emit(event, ...args);
  }

  /**
   * Check if a message/item ID has already been processed
   * @param {string} id
   * @returns {boolean}
   */
  isDuplicate(id) {
    return this.connector._isDuplicate(id);
  }

  /**
   * Process a chat action item from InnerTube live chat
   * @param {object} action The raw action object
   * @param {object} context Context object (e.g. { videoId })
   * @returns {boolean} True if this handler processed the action
   */
  handleAction(action, context = {}) {
    return false;
  }

  /**
   * Process updated metadata updates from InnerTube
   * @param {object} updates The parsed metadata updates
   * @param {object} context Context object (e.g. { videoId })
   */
  handleMetadata(updates, context = {}) {}

  /**
   * Process framework mutations (e.g. emoji reactions)
   * @param {Array} mutations Framework entity mutations
   * @param {object} context Context object
   */
  handleFrameworkUpdate(mutations, context = {}) {}

  /**
   * Reset internal handler state (e.g. on disconnect or new connect)
   */
  reset() {}
}

module.exports = BaseHandler;
