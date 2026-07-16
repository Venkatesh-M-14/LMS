import type { NotificationType, NotificationView } from '@academy/shared';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationView>;
  list(userId: string, limit: number): Promise<NotificationView[]>;
  unreadCount(userId: string): Promise<number>;
  /** Marks the given ids (or all when `ids` is null) read; returns new unread count. */
  markRead(userId: string, ids: string[] | null): Promise<number>;
}

/** Realtime push seam — implemented over Socket.IO in server.ts, no-op in tests. */
export interface NotificationPusher {
  push(userId: string, event: { notification: NotificationView; unreadCount: number }): void;
}
