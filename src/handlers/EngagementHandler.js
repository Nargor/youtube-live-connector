'use strict';

const BaseHandler = require('./BaseHandler');
const { parseViewerEngagementMessage } = require('../parsers/chatParser');

/**
 * EngagementHandler
 * Handles system/engagement notices and subscriber events (events: 'engagement', 'subscribe', 'follow')
 */
class EngagementHandler extends BaseHandler {
  handleAction(action) {
    const item = this.getActionItem(action);
    if (item?.liveChatViewerEngagementMessageRenderer) {
      const data = parseViewerEngagementMessage(item.liveChatViewerEngagementMessageRenderer);
      if (data && !this.isDuplicate(data.id)) {
        this.emit('engagement', data);
        if (data.isSubscribeNotice) {
          const subEvent = {
            id: data.id,
            message: data.message,
            isMembership: false,
            subType: 'engagement_notice',
            timestamp: data.timestamp,
            raw: data.raw
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
