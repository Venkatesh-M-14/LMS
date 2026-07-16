import { z } from 'zod';

/** Chat: one shared circle room, 1:1 DMs, and per-lesson discussion threads. */

export const CHAT_CHANNEL_TYPES = ['GROUP', 'DIRECT', 'LESSON'] as const;
export type ChatChannelType = (typeof CHAT_CHANNEL_TYPES)[number];

export interface ChatMessageView {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ChatChannelView {
  id: string;
  type: ChatChannelType;
  /** Display name: the room's name, the peer's name for a DM, or the lesson title. */
  title: string;
  lessonId: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

/** Someone in the circle you can start a DM with. */
export interface ChatPeer {
  userId: string;
  displayName: string;
}

export const sendChatMessageRequestSchema = z.object({
  body: z.string().trim().min(1, 'Message is required').max(2000),
});
export type SendChatMessageRequest = z.infer<typeof sendChatMessageRequestSchema>;

export const startDirectChannelRequestSchema = z.object({
  userId: z.string().min(1),
});
export type StartDirectChannelRequest = z.infer<typeof startDirectChannelRequestSchema>;

/** Cursor-paginated history, newest page first; cursor walks backwards in time. */
export interface ChatMessagePage {
  messages: ChatMessageView[];
  nextCursor: string | null;
}

/** Realtime payload pushed on `chat:message` to a channel's room. */
export interface ChatPushEvent {
  channelId: string;
  message: ChatMessageView;
}
