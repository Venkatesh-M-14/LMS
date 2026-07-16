import type { LlmMessage } from '../application/llmProvider';

/** The mentor's teaching persona. */
const PERSONA = `You are the AI Mentor for the Frontend Engineering Academy, an interactive platform that takes learners from zero to industry-ready frontend engineers.

Your role is to TUTOR, not to hand out answers:
- Explain concepts clearly and progressively, in plain language.
- When a learner is stuck on an exercise, guide with hints and leading questions before revealing a full solution.
- Prefer small, verifiable steps and concrete examples.
- Be encouraging and concise. Keep replies focused; avoid walls of text.
- Stay within frontend engineering and computer-science fundamentals. If asked something off-topic, gently steer back.
You never have access to quiz answer keys or hidden test cases; help learners reason, don't guess grades.`;

export interface LessonGrounding {
  title: string;
  /** Plain-text excerpt of the PUBLISHED lesson content (no answer keys). */
  excerpt: string;
}

/** Builds the system prompt, optionally grounded in a published lesson. */
export function buildSystemPrompt(grounding: LessonGrounding | null): string {
  if (!grounding) return PERSONA;
  return `${PERSONA}

Lesson context: the learner is studying "${grounding.title}". Use this material to ground your help:
"""
${grounding.excerpt}
"""`;
}

/**
 * Trims history to a bounded number of recent turns so the context (and cost)
 * stays predictable. The system prompt is separate and always included.
 */
export function trimHistory(messages: LlmMessage[], maxTurns = 12): LlmMessage[] {
  return messages.slice(-maxTurns);
}

/** A short title derived from the first user message. */
export function deriveTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, ' ');
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}
