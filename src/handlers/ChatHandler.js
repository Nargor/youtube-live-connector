'use strict';

const BaseHandler = require('./BaseHandler');
const { parseChatMessage } = require('../parsers/chatParser');

/**
 * ChatHandler
 * Handles standard chat comments (event: 'chat')
 */
class ChatHandler extends BaseHandler {
  handleAction(action) {
    const item = this.getActionItem(action);
    if (item?.liveChatTextMessageRenderer) {
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
