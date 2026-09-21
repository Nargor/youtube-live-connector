'use strict';

const BaseHandler = require('./BaseHandler');
const { parseChatMessage } = require('../parsers/chatParser');

/**
 * ChatHandler
 * Handles standard chat comments (event: 'chat')
 */
class ChatHandler extends BaseHandler {
  /**
   * Process incoming chat action
   * @param {object} action
   * @param {object} context
   * @returns {boolean}
   */
  handleAction(action, context = {}) {
    const item = action.addChatItemAction?.item ||
                 action.addLiveChatTickerItemAction?.item ||
                 action.addLiveChatItemToGroupAction?.item;
    if (!item) return false;

    if (item.liveChatTextMessageRenderer) {
      const chatData = parseChatMessage(item.liveChatTextMessageRenderer);
      if (chatData && !this.isDuplicate(chatData.id)) {
        this.emit('chat', chatData);
        return true;
      }
    }

    return false;
  }
}

module.exports = ChatHandler;
