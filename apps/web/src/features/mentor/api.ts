import type {
  MentorBudget,
  MentorConversationDetail,
  MentorConversationSummary,
  MentorStreamChunk,
} from '@academy/shared';
import { apiRequest, readCsrfToken, tryRefreshSession } from '../../shared/api/client';
import { store } from '../../app/store';

export const mentorKeys = {
  budget: ['mentor', 'budget'] as const,
  conversations: ['mentor', 'conversations'] as const,
  conversation: (id: string) => ['mentor', 'conversation', id] as const,
};

export function fetchMentorBudget(): Promise<MentorBudget> {
  return apiRequest('/mentor/budget');
}

export function fetchConversations(): Promise<MentorConversationSummary[]> {
  return apiRequest('/mentor/conversations');
}

export function createConversation(lessonId?: string): Promise<{ id: string }> {
  return apiRequest('/mentor/conversations', {
    method: 'POST',
    body: lessonId ? { lessonId } : {},
  });
}

export function fetchConversation(id: string): Promise<MentorConversationDetail> {
  return apiRequest(`/mentor/conversations/${id}`);
}

function streamRequest(conversationId: string, message: string, signal?: AbortSignal) {
  const accessToken = store.getState().auth.accessToken;
  const csrf = readCsrfToken();
  return fetch(`/api/v1/mentor/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ message }),
    signal,
  });
}

/**
 * Streams a mentor reply, invoking `onChunk` per SSE frame. Uses fetch (not
 * EventSource) so we can POST the message and send the auth header. Retries
 * once after a silent token refresh on a 401.
 */
export async function streamMentorMessage(
  conversationId: string,
  message: string,
  onChunk: (chunk: MentorStreamChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response = await streamRequest(conversationId, message, signal);
  if (response.status === 401 && (await tryRefreshSession())) {
    response = await streamRequest(conversationId, message, signal);
  }

  if (!response.ok || !response.body) {
    throw new Error(`Mentor stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        onChunk(JSON.parse(line.slice('data: '.length)) as MentorStreamChunk);
      } catch {
        // ignore a malformed frame
      }
    }
  }
}
