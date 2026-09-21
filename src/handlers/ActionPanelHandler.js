'use strict';

const BaseHandler = require('./BaseHandler');

/**
 * ActionPanelHandler
 * Handles live chat action panels such as pinned messages and polls (event: 'actionPanel')
 */
class ActionPanelHandler extends BaseHandler {
  /**
   * Process incoming action panel action
   * @param {object} action
   * @param {object} context
   * @returns {boolean}
   */
  handleAction(action, context = {}) {
    if (action.showLiveChatActionPanelAction) {
      this.emit('actionPanel', action.showLiveChatActionPanelAction);
      return true;
    }
    return false;
  }
}

module.exports = ActionPanelHandler;
