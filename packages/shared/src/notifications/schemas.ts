import { z } from 'zod';

/** In-app notifications: live-pushed over Socket.IO and listed in the center. */

export const NOTIFICATION_TYPES = [
  'QUIZ_PASSED',
  'QUIZ_FAILED',
  'ACHIEVEMENT_EARNED',
  'CERTIFICATE_ISSUED',
  'PROJECT_REVIEWED',
  'REVISION_ASSIGNED',
  'LESSON_UNLOCKED',
  // M10 — the circle sees each other's wins and rank changes.
  'PEER_SUCCESS',
  'OVERTAKEN',
  'SUGGESTION_SUBMITTED',
  'SUGGESTION_REVIEWED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app deep link, or null. */
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListView {
  items: NotificationView[];
  unreadCount: number;
}

/** Mark specific notifications read, or all when `ids` is omitted. */
export const markNotificationsReadRequestSchema = z.object({
  ids: z.array(z.string().min(1)).max(200).optional(),
});
export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;

/** The realtime payload pushed on `notification:new`. */
export interface NotificationPushEvent {
  notification: NotificationView;
  unreadCount: number;
}

// ── Preferences (M10) ────────────────────────────────────────────────────────

/** Peer chatter is opt-out: your own results always notify you. */
export interface NotificationPreferences {
  /** In-app notifications when someone else in the circle succeeds. */
  notifyPeerSuccess: boolean;
  /** In-app notification when a peer overtakes you on the leaderboard. */
  notifyOvertaken: boolean;
  /** Email for milestones (a peer's certificate, your own certificate). */
  emailMilestones: boolean;
}

export const updateNotificationPreferencesRequestSchema = z.object({
  notifyPeerSuccess: z.boolean().optional(),
  notifyOvertaken: z.boolean().optional(),
  emailMilestones: z.boolean().optional(),
});
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
