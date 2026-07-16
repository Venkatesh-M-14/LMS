import { z } from 'zod';
import { authoringItemSchema } from '../assessments/schemas';

/** Student input into the syllabus: a free-text idea, or a complete draft
 * question an admin can accept straight into the lesson's question bank. */

export const SUGGESTION_KINDS = ['IDEA', 'DRAFT_QUESTION'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/**
 * A draft reuses the same contract the authoring editor writes, so accepting
 * one is a straight hand-off to the question bank — no second format to keep
 * in sync.
 */
export const createSuggestionRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('IDEA'),
    /** Optional: the lesson the idea relates to. */
    lessonId: z.string().min(1).optional(),
    body: z.string().trim().min(10, 'Tell us a little more').max(2000),
  }),
  z.object({
    kind: z.literal('DRAFT_QUESTION'),
    /** Required — this is the bank the question would join. */
    lessonId: z.string().min(1, 'Pick the lesson this question belongs to'),
    /** Optional rationale for the reviewer. */
    body: z.string().trim().max(2000).default(''),
    draft: authoringItemSchema,
  }),
]);
export type CreateSuggestionRequest = z.infer<typeof createSuggestionRequestSchema>;

export const reviewSuggestionRequestSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
  adminNote: z.string().trim().max(1000).optional(),
});
export type ReviewSuggestionRequest = z.infer<typeof reviewSuggestionRequestSchema>;

export interface SuggestionView {
  id: string;
  kind: SuggestionKind;
  status: SuggestionStatus;
  authorId: string;
  authorName: string;
  lessonId: string | null;
  lessonTitle: string | null;
  body: string;
  /** Present for DRAFT_QUESTION — shape of `authoringItemSchema`. */
  draft: unknown | null;
  adminNote: string | null;
  reviewedAt: string | null;
  /** Set when an accepted draft became a real question. */
  createdItemId: string | null;
  createdAt: string;
}
