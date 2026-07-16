import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MentorMessageView } from '@academy/shared';
import { fetchConversation, mentorKeys, streamMentorMessage } from './api';

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
}

interface MentorChatState {
  messages: ChatMessage[];
  /** Assistant text accumulating during an in-flight stream, or null. */
  streaming: string | null;
  isStreaming: boolean;
  error: string | null;
  loadingHistory: boolean;
  send: (message: string) => void;
  reset: () => void;
}

let localSeq = 0;
const localId = (prefix: string) => `local-${prefix}-${(localSeq += 1)}`;

/**
 * Drives one mentor conversation: loads history, appends the user's message,
 * streams the assistant reply token-by-token, and refreshes the budget on
 * completion. Errors (budget exceeded, not configured) surface via `error`.
 */
export function useMentorChat(conversationId: string | null): MentorChatState {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load (or clear) history when the active conversation changes.
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(null);
    setIsStreaming(false);
    setError(null);
    if (!conversationId) return;

    let cancelled = false;
    setLoadingHistory(true);
    fetchConversation(conversationId)
      .then((detail) => {
        if (cancelled) return;
        setMessages(
          detail.messages.map((m: MentorMessageView) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setError('load');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!conversationId || !trimmed || isStreaming) return;

      setError(null);
      setMessages((prev) => [...prev, { id: localId('user'), role: 'USER', content: trimmed }]);
      setStreaming('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let assembled = '';
      let assistantId = localId('assistant');

      streamMentorMessage(
        conversationId,
        trimmed,
        (chunk) => {
          switch (chunk.type) {
            case 'start':
              assistantId = chunk.messageId;
              break;
            case 'delta':
              assembled += chunk.text;
              setStreaming(assembled);
              break;
            case 'done':
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'ASSISTANT', content: chunk.content },
              ]);
              setStreaming(null);
              setIsStreaming(false);
              queryClient.setQueryData(mentorKeys.budget, (old: unknown) =>
                old && typeof old === 'object'
                  ? {
                      ...(old as object),
                      tokensUsedToday: chunk.tokensUsedToday,
                      remaining: chunk.remaining,
                    }
                  : old,
              );
              void queryClient.invalidateQueries({ queryKey: mentorKeys.conversations });
              break;
            case 'error':
              setStreaming(null);
              setIsStreaming(false);
              setError(chunk.code);
              break;
          }
        },
        controller.signal,
      ).catch(() => {
        if (controller.signal.aborted) return;
        setStreaming(null);
        setIsStreaming(false);
        setError('stream');
      });
    },
    [conversationId, isStreaming, queryClient],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(null);
    setIsStreaming(false);
    setError(null);
  }, []);

  return { messages, streaming, isStreaming, error, loadingHistory, send, reset };
}
