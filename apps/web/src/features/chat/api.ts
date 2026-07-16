import type {
  ChatChannelView,
  ChatMessagePage,
  ChatPeer,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const chatKeys = {
  channels: ['chat', 'channels'] as const,
  peers: ['chat', 'peers'] as const,
  messages: (channelId: string) => ['chat', 'messages', channelId] as const,
};

export function fetchChannels(): Promise<ChatChannelView[]> {
  return apiRequest('/chat/channels');
}

export function fetchPeers(): Promise<ChatPeer[]> {
  return apiRequest('/chat/peers');
}

export function fetchGroupChannel(): Promise<ChatChannelView> {
  return apiRequest('/chat/channels/group');
}

export function fetchLessonChannel(lessonId: string): Promise<ChatChannelView> {
  return apiRequest(`/chat/channels/lesson/${lessonId}`);
}

export function startDirectChannel(userId: string): Promise<ChatChannelView> {
  return apiRequest('/chat/channels/direct', { method: 'POST', body: { userId } });
}

export function fetchMessages(channelId: string, before?: string): Promise<ChatMessagePage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return apiRequest(`/chat/channels/${channelId}/messages${query}`);
}

export function sendMessage(channelId: string, body: string): Promise<unknown> {
  return apiRequest(`/chat/channels/${channelId}/messages`, { method: 'POST', body: { body } });
}

export function markChannelRead(channelId: string): Promise<void> {
  return apiRequest(`/chat/channels/${channelId}/read`, { method: 'POST' });
}
