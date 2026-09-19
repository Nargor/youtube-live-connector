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

export type GiftEvent = SuperChatGift | SuperStickerGift | MembershipGift | MembershipGiftPurchase;

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
  likeCount: string;
  isLive: boolean;
  url: string;
}

export interface ConnectorOptions {
  url?: string;
  liveId?: string;
  channel?: string;
  pollViewers?: boolean;
  viewerIntervalMs?: number;
  chatIntervalMs?: number;
  ignoreInitialChat?: boolean;
  headers?: Record<string, string>;
}

export declare class YouTubeLiveConnector extends EventEmitter {
  constructor(options?: ConnectorOptions | string);

  connect(url?: string): Promise<StreamInfo>;
  disconnect(reason?: string): void;
  isConnected(): boolean;
  getStreamInfo(): StreamInfo | null;

  on(event: 'connected', listener: (streamInfo: StreamInfo) => void): this;
  on(event: 'disconnected', listener: (data: { reason: string }) => void): this;
  on(event: 'chat', listener: (message: ChatMessage) => void): this;
  on(event: 'gift', listener: (gift: GiftEvent) => void): this;
  on(event: 'superchat', listener: (superChat: SuperChatGift) => void): this;
  on(event: 'supersticker', listener: (sticker: SuperStickerGift) => void): this;
  on(event: 'member', listener: (member: MembershipGift) => void): this;
  on(event: 'memberGift', listener: (memberGift: MembershipGiftPurchase) => void): this;
  on(event: 'viewers', listener: (data: ViewersData) => void): this;
  on(event: 'roomUser', listener: (data: ViewersData) => void): this;
  on(event: 'title', listener: (data: { title: string }) => void): this;
  on(event: 'like', listener: (data: { likeCount: string }) => void): this;
  on(event: 'warning', listener: (data: { type: string; message: string }) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'raw', listener: (action: any) => void): this;
}

export declare function resolveVideoId(input: string, options?: any): Promise<{ videoId: string; finalUrl: string }>;
export declare function extractVideoIdSync(input: string): string | null;
