import { z } from 'zod';

/** AI Mentor: streaming chat with per-user budgets, and adaptive revision. */

export interface MentorMessageView {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface MentorConversationSummary {
  id: string;
  title: string;
  lessonId: string | null;
  lessonTitle: string | null;
  updatedAt: string;
}

export interface MentorConversationDetail extends MentorConversationSummary {
  messages: MentorMessageView[];
}

export interface MentorBudget {
  configured: boolean;
  dailyTokenBudget: number;
  tokensUsedToday: number;
  remaining: number;
}

export const startConversationRequestSchema = z.object({
  lessonId: z.string().min(1).optional(),
});
export type StartConversationRequest = z.infer<typeof startConversationRequestSchema>;

export const sendMentorMessageRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
});
export type SendMentorMessageRequest = z.infer<typeof sendMentorMessageRequestSchema>;

/**
 * SSE chunk protocol for a streaming mentor reply. Emitted as
 * `data: <json>\n\n` frames on the send endpoint.
 */
export type MentorStreamChunk =
  | { type: 'start'; conversationId: string; messageId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; content: string; tokensUsedToday: number; remaining: number }
  | { type: 'error'; code: string; message: string };

// ── Adaptive learning ────────────────────────────────────────────────────────

export interface RevisionAssignmentView {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  skillName: string;
  targetLessonId: string;
  targetLessonTitle: string;
  blocksRetake: boolean;
  status: 'ASSIGNED' | 'COMPLETED';
  reason: string;
  createdAt: string;
}
