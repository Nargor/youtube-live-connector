import { EventEmitter } from 'events';

export interface AuthorBadge {
  label: string;
  iconType: string;
  iconUrl: string;
}

export interface ChatAuthor {
  name: string;
  channelId: string;
  profilePictureUrl: string;
  isOwner: boolean;
  isModerator: boolean;
  isMember: boolean;
  isVerified: boolean;
  badges: AuthorBadge[];
}

export interface EmojiItem {
  emojiId: string;
  name: string;
  isCustom: boolean;
  url: string;
}

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  message: string;
  messageRuns: any[];
  emojis: EmojiItem[];
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface SuperChatGift {
  type: 'superchat';
  id: string;
  author: ChatAuthor;
  amount: number;
  currency: string;
  amountDisplay: string;
  message: string;
  emojis: EmojiItem[];
  colors: {
    headerBackgroundColor: string | null;
    headerTextColor: string | null;
    bodyBackgroundColor: string | null;
    bodyTextColor: string | null;
  };
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface SuperStickerGift {
  type: 'supersticker';
  id: string;
  author: ChatAuthor;
  amount: number;
  currency: string;
  amountDisplay: string;
  sticker: {
    url: string;
    alt: string;
  };
  backgroundColor: string | null;
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface MembershipGift {
  type: 'membership';
  id: string;
  author: ChatAuthor;
  headerText: string;
  subtext: string;
  message: string;
  emojis: EmojiItem[];
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface MembershipGiftPurchase {
  type: 'membership_gift';
  id: string;
  author: ChatAuthor;
  giftCount: number;
  headerText: string;
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface JewelsGift {
  type: 'jewels_gift';
  id: string;
  author: ChatAuthor;
  giftName: string;
  actionText: string;
  giftImage: {
    url: string;
    alt: string;
  };
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface MembershipRedeemGift {
  type: 'membership_redeem';
  id: string;
  author: ChatAuthor;
  gifterName: string;
  message: string;
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export type GiftEvent = SuperChatGift | SuperStickerGift | MembershipGift | MembershipGiftPurchase | JewelsGift | MembershipRedeemGift;

export interface ReactionItem {
  emoji: string;
  count: number;
}

export interface ReactionEvent {
  emoji: string;
  count: number;
  totalReactions: number;
  intensityScore: number;
  updateTimeUsec: string;
  timestamp: Date;
  raw: any;
}

export interface ReactionsBatchEvent {
  key: string;
  updateTimeUsec: string;
  totalReactions: number;
  intensityScore: number;
  durationSeconds: number;
  reactions: ReactionItem[];
  timestamp: Date;
  raw: any;
}

export interface LikeEvent {
  likeCount: number;
  likeCountDisplay: string;
  likesIncrement: number;
  timestamp: Date;
}

export interface SubscribeEvent {
  id: string;
  author?: ChatAuthor;
  isMembership: boolean;
  subType: 'membership' | 'engagement_notice' | string;
  headerText?: string;
  message?: string;
  timestamp: Date;
  raw: any;
}

export interface EngagementEvent {
  id: string;
  message: string;
  iconType: string;
  actionButtonText?: string;
  isSubscribeNotice: boolean;
  timestamp: Date;
  timestampUsec: number;
  raw: any;
}

export interface ViewersData {
  viewerCount: number;
  viewerCountDisplay: string;
  timestamp: Date;
}

export interface StreamInfo {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  channelUrl: string;
  viewerCount: number;
  viewerCountDisplay: string;
  likeCount: number;
  likeCountDisplay: string;
  isLive: boolean;
  url: string;
}

export interface ConnectorOptions {
  url?: string;
  liveId?: string;
  channel?: string;
  username?: string;
  uniqueId?: string;
  pollViewers?: boolean;
  viewerIntervalMs?: number;
  chatIntervalMs?: number;
  ignoreInitialChat?: boolean;
  autoDisconnectOnEnd?: boolean;
  headers?: Record<string, string>;
}

export declare class YouTubeLiveConnector extends EventEmitter {
  username?: string | null;
  videoId?: string | null;
  streamInfo?: StreamInfo | null;
  connected: boolean;
  autoDisconnectOnEnd: boolean;

  constructor(options?: ConnectorOptions | string);

  connect(url?: string): Promise<StreamInfo>;
  disconnect(reason?: string): void;
  isConnected(): boolean;
  getStreamInfo(): StreamInfo | null;

  on(event: 'connected', listener: (streamInfo: StreamInfo) => void): this;
  on(event: 'disconnected', listener: (data: { reason: string }) => void): this;
  on(event: 'streamEnded', listener: (data: { videoId: string; reason: string }) => void): this;
  on(event: 'chatEnded', listener: (data: { videoId: string; retryCount?: number }) => void): this;
  on(event: 'chat', listener: (message: ChatMessage) => void): this;
  on(event: 'gift', listener: (gift: GiftEvent) => void): this;
  on(event: 'superchat', listener: (superChat: SuperChatGift) => void): this;
  on(event: 'supersticker', listener: (sticker: SuperStickerGift) => void): this;
  on(event: 'member', listener: (member: MembershipGift) => void): this;
  on(event: 'memberGift', listener: (memberGift: MembershipGiftPurchase) => void): this;
  on(event: 'memberRedeem', listener: (redeem: MembershipRedeemGift) => void): this;
  on(event: 'jewelsGift', listener: (jewelsGift: JewelsGift) => void): this;
  on(event: 'reaction', listener: (reaction: ReactionEvent) => void): this;
  on(event: 'reactions', listener: (reactionsBatch: ReactionsBatchEvent) => void): this;
  on(event: 'like', listener: (data: LikeEvent) => void): this;
  on(event: 'subscribe', listener: (data: SubscribeEvent) => void): this;
  on(event: 'follow', listener: (data: SubscribeEvent) => void): this;
  on(event: 'engagement', listener: (data: EngagementEvent) => void): this;
  on(event: 'viewers', listener: (data: ViewersData) => void): this;
  on(event: 'roomUser', listener: (data: ViewersData) => void): this;
  on(event: 'title', listener: (data: { title: string }) => void): this;
  on(event: 'warning', listener: (data: { type: string; message: string }) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'raw', listener: (action: any) => void): this;
}

export declare function resolveVideoId(input: string, options?: any): Promise<{ videoId: string; finalUrl: string }>;
export declare function extractVideoIdSync(input: string): string | null;
export declare function parseChatMessage(renderer: any): ChatMessage | null;
export declare function parseViewerEngagementMessage(renderer: any): EngagementEvent | null;
export declare function parseEmojiReactions(mutations: any[]): ReactionsBatchEvent[];
export declare function parseSuperChat(renderer: any): SuperChatGift | null;
export declare function parseSuperSticker(renderer: any): SuperStickerGift | null;
export declare function parseMembership(renderer: any): MembershipGift | null;
export declare function parseGiftMemberships(renderer: any): MembershipGiftPurchase | null;
export declare function parseJewelsGift(viewModel: any): JewelsGift | null;
export declare function parseGiftRedemption(renderer: any): MembershipRedeemGift | null;
export declare function parseInitialStreamInfo(ytInitialData: any, videoId: string): StreamInfo;
export declare function parseUpdatedMetadataActions(actions: any[]): any;
export declare function parseViewerCount(str: string): number;
export declare function parsePrice(text: string): { amount: number; currency: string; raw: string };

export default YouTubeLiveConnector;
