import type { ChatChannelType, ChatMessageView, ChatPeer } from '@academy/shared';

export interface ChannelRow {
  id: string;
  type: ChatChannelType;
  key: string;
  lessonId: string | null;
}

export interface ChannelListRow extends ChannelRow {
  title: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface ChatRepository {
  /** Atomic get-or-create on the unique channel key. */
  ensureChannel(input: {
    key: string;
    type: ChatChannelType;
    lessonId: string | null;
    /** DIRECT only: the two members whose ACL rows must exist. */
    memberIds?: string[];
  }): Promise<ChannelRow>;

  getChannelById(channelId: string): Promise<ChannelRow | null>;
  /** DIRECT membership is the ACL; GROUP/LESSON are open to the circle. */
  isMember(channelId: string, userId: string): Promise<boolean>;
  /** Creates the read-marker row if absent (GROUP/LESSON lazy join). */
  ensureMembership(channelId: string, userId: string): Promise<void>;

  listChannelsFor(userId: string): Promise<ChannelListRow[]>;
  listPeers(userId: string): Promise<ChatPeer[]>;

  /** Newest-first page; `before` walks backwards in time. */
  listMessages(
    channelId: string,
    limit: number,
    before?: string,
  ): Promise<{ messages: ChatMessageView[]; nextCursor: string | null }>;

  postMessage(channelId: string, authorId: string, body: string): Promise<ChatMessageView>;
  markRead(channelId: string, userId: string): Promise<void>;

  /** Recipients to notify/push for a channel (DM peers, or the whole circle). */
  recipientsFor(channel: ChannelRow, exceptUserId: string): Promise<string[]>;

  lessonTitle(lessonId: string): Promise<string | null>;
}

/**
 * Realtime seam — Socket.IO in server.ts, no-op in tests. Delivery targets the
 * recipients' own authenticated user rooms (already joined at connect), so a
 * DM can only ever reach its two members — no extra channel-room auth surface.
 */
export interface ChatPusher {
  push(recipientIds: string[], event: { channelId: string; message: ChatMessageView }): void;
}
