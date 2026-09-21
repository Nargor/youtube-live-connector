'use strict';

const BaseHandler = require('./BaseHandler');
const { parseViewerEngagementMessage } = require('../parsers/chatParser');

/**
 * EngagementHandler
 * Handles system/engagement notices and subscriber events (events: 'engagement', 'subscribe', 'follow')
 */
class EngagementHandler extends BaseHandler {
  /**
   * Process incoming action for engagement messages
   * @param {object} action
   * @param {object} context
   * @returns {boolean}
   */
  handleAction(action, context = {}) {
    const item = action.addChatItemAction?.item ||
                 action.addLiveChatTickerItemAction?.item ||
                 action.addLiveChatItemToGroupAction?.item;
    if (!item) return false;

    if (item.liveChatViewerEngagementMessageRenderer) {
      const engagementData = parseViewerEngagementMessage(item.liveChatViewerEngagementMessageRenderer);
      if (engagementData && !this.isDuplicate(engagementData.id)) {
        this.emit('engagement', engagementData);

        if (engagementData.isSubscribeNotice) {
          const subEvent = {
            id: engagementData.id,
            message: engagementData.message,
            isMembership: false,
            subType: 'engagement_notice',
            timestamp: engagementData.timestamp,
            raw: engagementData.raw
          };
          this.emit('subscribe', subEvent);
          this.emit('follow', subEvent);
        }
        return true;
      }
    }

    return false;
  }
}

module.exports = EngagementHandler;
