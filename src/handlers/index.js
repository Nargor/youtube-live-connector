'use strict';

const BaseHandler = require('./BaseHandler');
const ChatHandler = require('./ChatHandler');
const GiftHandler = require('./GiftHandler');
const LikeHandler = require('./LikeHandler');
const ReactionHandler = require('./ReactionHandler');
const ViewerHandler = require('./ViewerHandler');
const EngagementHandler = require('./EngagementHandler');
const StreamLifecycleHandler = require('./StreamLifecycleHandler');
const ActionPanelHandler = require('./ActionPanelHandler');

/**
 * HandlerRegistry
 * Manages all event handlers and orchestrates dispatching
 */
class HandlerRegistry {
  /**
   * @param {import('../YouTubeLiveConnector')} connector
   */
  constructor(connector) {
    this.connector = connector;

    // Instantiate modular OOP handlers
    this.chat = new ChatHandler(connector);
    this.gift = new GiftHandler(connector);
    this.like = new LikeHandler(connector);
    this.reaction = new ReactionHandler(connector);
    this.viewer = new ViewerHandler(connector);
    this.engagement = new EngagementHandler(connector);
    this.lifecycle = new StreamLifecycleHandler(connector);
    this.actionPanel = new ActionPanelHandler(connector);

    // List of action handlers in order of evaluation
    this.actionHandlers = [
      this.gift,        // Check gifts & jewels first
      this.chat,        // Standard text chat
      this.engagement,  // Engagement & subscriber notices
      this.actionPanel  // Pinned messages & polls
    ];

    // List of metadata handlers
    this.metadataHandlers = [
      this.viewer,
      this.like,
      this.lifecycle
    ];

    // List of framework update handlers
    this.frameworkHandlers = [
      this.reaction
    ];

    // All handlers list for lifecycle operations
    this.allHandlers = [
      this.chat,
      this.gift,
      this.like,
      this.reaction,
      this.viewer,
      this.engagement,
      this.lifecycle,
      this.actionPanel
    ];
  }

  /**
   * Dispatch a single chat action to registered action handlers
   * @param {object} action
   * @param {object} [context={}]
   * @returns {boolean} True if handled
   */
  dispatchAction(action, context = {}) {
    for (const handler of this.actionHandlers) {
      if (handler.handleAction(action, context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Dispatch actions array from live chat
   * @param {Array} actions
   * @param {object} [context={}]
   */
  dispatchActions(actions, context = {}) {
    if (!Array.isArray(actions)) return;
    for (const action of actions) {
      // Emit raw action first
      this.connector.emit('raw', action);
      this.dispatchAction(action, context);
    }
  }

  /**
   * Dispatch metadata updates to registered metadata handlers
   * @param {object} updates
   * @param {object} [context={}]
   */
  dispatchMetadata(updates, context = {}) {
    if (!updates) return;
    for (const handler of this.metadataHandlers) {
      handler.handleMetadata(updates, context);
    }
  }

  /**
   * Dispatch framework mutations to registered framework handlers
   * @param {Array} mutations
   * @param {object} [context={}]
   */
  dispatchFramework(mutations, context = {}) {
    if (!Array.isArray(mutations)) return;
    for (const handler of this.frameworkHandlers) {
      handler.handleFrameworkUpdate(mutations, context);
    }
  }

  /**
   * Reset all handlers
   */
  reset() {
    for (const handler of this.allHandlers) {
      handler.reset();
    }
  }
}

module.exports = {
  HandlerRegistry,
  BaseHandler,
  ChatHandler,
  GiftHandler,
  LikeHandler,
  ReactionHandler,
  ViewerHandler,
  EngagementHandler,
  StreamLifecycleHandler,
  ActionPanelHandler
};
