import type {
  MentorConversationDetail,
  MentorConversationSummary,
} from '@academy/shared';
import type { LlmMessage } from './llmProvider';

export interface ConversationRow {
  id: string;
  userId: string;
  lessonId: string | null;
}

export interface MentorRepository {
  getUserTimezone(userId: string): Promise<string>;

  createConversation(userId: string, lessonId: string | null): Promise<{ id: string }>;
  listConversations(userId: string): Promise<MentorConversationSummary[]>;
  getConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<MentorConversationDetail | null>;
  getConversationRow(conversationId: string): Promise<ConversationRow | null>;
  /** Prior turns for the model, oldest first. */
  getHistory(conversationId: string): Promise<LlmMessage[]>;

  appendUserMessage(conversationId: string, content: string): Promise<{ id: string }>;
  /** Persists the assistant reply + token counts and touches the conversation. */
  appendAssistantMessage(
    conversationId: string,
    content: string,
    tokens: { inputTokens: number; outputTokens: number },
  ): Promise<{ id: string }>;
  setTitleIfDefault(conversationId: string, title: string): Promise<void>;

  /**
   * PUBLISHED lesson content as plain text for grounding — no answer keys or
   * hidden tests (those never live in published content blocks).
   */
  getLessonGrounding(lessonId: string): Promise<{ title: string; excerpt: string } | null>;

  // Daily token budget.
  getTokensUsed(userId: string, day: string): Promise<number>;
  addUsage(userId: string, day: string, tokens: number): Promise<void>;
}
