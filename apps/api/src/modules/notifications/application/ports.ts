import type {
  NotificationPreferences,
  NotificationType,
  NotificationView,
} from '@academy/shared';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
}

/** Which opt-out flag a fan-out respects. */
export type PeerPreference = 'notifyPeerSuccess' | 'notifyOvertaken';

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationView>;
  /** Bulk fan-out to the circle; returns the rows created. */
  createMany(inputs: CreateNotificationInput[]): Promise<NotificationView[]>;
  list(userId: string, limit: number): Promise<NotificationView[]>;
  unreadCount(userId: string): Promise<number>;
  /** Marks the given ids (or all when `ids` is null) read; returns new unread count. */
  markRead(userId: string, ids: string[] | null): Promise<number>;

  /** Active members other than `exceptUserId` who haven't opted out of `pref`. */
  listPeerRecipients(exceptUserId: string, pref: PeerPreference): Promise<string[]>;
  /** Admins — the review queue for student suggestions. */
  listAdmins(): Promise<string[]>;
  /** True when the user still wants this class of notification. */
  wants(userId: string, pref: PeerPreference): Promise<boolean>;
  displayName(userId: string): Promise<string | null>;

  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences>;
}

/** Realtime push seam — implemented over Socket.IO in server.ts, no-op in tests. */
export interface NotificationPusher {
  push(userId: string, event: { notification: NotificationView; unreadCount: number }): void;
}
