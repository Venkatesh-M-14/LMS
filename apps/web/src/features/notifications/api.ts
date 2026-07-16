import type {
  NotificationListView,
  NotificationPreferences,
  UpdateNotificationPreferencesRequest,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const notificationKeys = {
  list: ['notifications', 'list'] as const,
  preferences: ['notifications', 'preferences'] as const,
};

export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return apiRequest('/notifications/preferences');
}

export function updateNotificationPreferences(
  patch: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferences> {
  return apiRequest('/notifications/preferences', { method: 'PATCH', body: patch });
}

export function fetchNotifications(): Promise<NotificationListView> {
  return apiRequest('/notifications');
}

/** Mark specific ids read, or all unread when `ids` is omitted. */
export function markNotificationsRead(ids?: string[]): Promise<{ unreadCount: number }> {
  return apiRequest('/notifications/read', { method: 'POST', body: ids ? { ids } : {} });
}
