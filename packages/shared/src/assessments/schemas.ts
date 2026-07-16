import { z } from 'zod';
import { CODE_LANGUAGES } from '../content/blocks';

/**
 * Assessment contracts. Two views of every item:
 *  - the FULL payload (authoring + grading; contains answer keys)
 *  - the STUDENT view (answer keys stripped) — the only shape that may travel
 *    to a learner while an attempt is in progress.
 */

export const ASSESSMENT_ITEM_SCHEMA_VERSION = 1;

export const AssessmentItemTypes = [
  'MCQ',
  'MULTI_SELECT',
  'OUTPUT_PREDICTION',
  'REFLECTION',
] as const;
export const assessmentItemTypeSchema = z.enum(AssessmentItemTypes);
export type AssessmentItemType = z.infer<typeof assessmentItemTypeSchema>;

export const attemptStatusSchema = z.enum(['IN_PROGRESS', 'GRADING', 'GRADED']);
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;

// ── Full payloads (answer keys included) ────────────────────────────────────

const optionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(1).max(500),
});

const uniqueIds = (options: Array<{ id: string }>) =>
  new Set(options.map((o) => o.id)).size === options.length;

export const mcqPayloadSchema = z
  .object({
    prompt: z.string().trim().min(1).max(5000),
    options: z.array(optionSchema).min(2).max(8),
    correctOptionId: z.string().min(1),
    explanation: z.string().trim().max(2000).optional(),
  })
  .refine((p) => uniqueIds(p.options), { message: 'Option ids must be unique', path: ['options'] })
  .refine((p) => p.options.some((o) => o.id === p.correctOptionId), {
    message: 'correctOptionId must reference an option',
    path: ['correctOptionId'],
  });

export const multiSelectPayloadSchema = z
  .object({
    prompt: z.string().trim().min(1).max(5000),
    options: z.array(optionSchema).min(2).max(10),
    correctOptionIds: z.array(z.string().min(1)).min(1),
    explanation: z.string().trim().max(2000).optional(),
  })
  .refine((p) => uniqueIds(p.options), { message: 'Option ids must be unique', path: ['options'] })
  .refine((p) => new Set(p.correctOptionIds).size === p.correctOptionIds.length, {
    message: 'correctOptionIds must be unique',
    path: ['correctOptionIds'],
  })
  .refine((p) => p.correctOptionIds.every((id) => p.options.some((o) => o.id === id)), {
    message: 'Every correctOptionId must reference an option',
    path: ['correctOptionIds'],
  });

export const outputMatchModeSchema = z.enum(['exact', 'trimmed', 'normalized']);
export type OutputMatchMode = z.infer<typeof outputMatchModeSchema>;

export const outputPredictionPayloadSchema = z.object({
  prompt: z.string().trim().min(1).max(5000),
  language: z.enum(CODE_LANGUAGES),
  code: z.string().min(1).max(10_000),
  expectedOutput: z.string().min(1).max(2000),
  /** exact: verbatim · trimmed: ends trimmed · normalized: casefold + collapse whitespace */
  matchMode: outputMatchModeSchema,
  explanation: z.string().trim().max(2000).optional(),
});

export const reflectionPayloadSchema = z.object({
  prompt: z.string().trim().min(1).max(5000),
  guidance: z.string().trim().max(2000).optional(),
  minWords: z.number().int().min(1).max(1000).optional(),
});

export const assessmentItemPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MCQ'), payload: mcqPayloadSchema }),
  z.object({ type: z.literal('MULTI_SELECT'), payload: multiSelectPayloadSchema }),
  z.object({ type: z.literal('OUTPUT_PREDICTION'), payload: outputPredictionPayloadSchema }),
  z.object({ type: z.literal('REFLECTION'), payload: reflectionPayloadSchema }),
]);
export type AssessmentItemPayload = z.infer<typeof assessmentItemPayloadSchema>;

export type McqPayload = z.infer<typeof mcqPayloadSchema>;
export type MultiSelectPayload = z.infer<typeof multiSelectPayloadSchema>;
export type OutputPredictionPayload = z.infer<typeof outputPredictionPayloadSchema>;
export type ReflectionPayload = z.infer<typeof reflectionPayloadSchema>;

// ── Answers ─────────────────────────────────────────────────────────────────

export const mcqAnswerSchema = z.object({ selectedOptionId: z.string().min(1).max(40) });
export const multiSelectAnswerSchema = z.object({
  selectedOptionIds: z.array(z.string().min(1).max(40)).max(10),
});
export const outputPredictionAnswerSchema = z.object({
  predictedOutput: z.string().max(2000),
});
export const reflectionAnswerSchema = z.object({ text: z.string().max(10_000) });

export const answerSchemaByType: Record<AssessmentItemType, z.ZodTypeAny> = {
  MCQ: mcqAnswerSchema,
  MULTI_SELECT: multiSelectAnswerSchema,
  OUTPUT_PREDICTION: outputPredictionAnswerSchema,
  REFLECTION: reflectionAnswerSchema,
};

export const saveAnswersRequestSchema = z.object({
  /** itemId → answer; each answer is validated against its item's type server-side. */
  answers: z.record(z.string(), z.unknown()),
});
export type SaveAnswersRequest = z.infer<typeof saveAnswersRequestSchema>;

// ── Student views (sanitized) ───────────────────────────────────────────────

export interface StudentItemView {
  itemId: string;
  order: number;
  type: AssessmentItemType;
  points: number;
  /** Payload with every answer key stripped. */
  payload: unknown;
}

/** Strips answer keys from a full payload. The ONLY sanctioned sanitizer. */
export function toStudentPayload(item: AssessmentItemPayload): unknown {
  switch (item.type) {
    case 'MCQ':
      return { prompt: item.payload.prompt, options: item.payload.options };
    case 'MULTI_SELECT':
      return { prompt: item.payload.prompt, options: item.payload.options };
    case 'OUTPUT_PREDICTION':
      return {
        prompt: item.payload.prompt,
        language: item.payload.language,
        code: item.payload.code,
      };
    case 'REFLECTION':
      return item.payload;
  }
}

// ── Attempt DTOs ────────────────────────────────────────────────────────────

export interface AssessmentSummary {
  id: string;
  title: string;
  passingScorePct: number;
  maxAttempts: number | null;
  cooldownMinutes: number;
  itemCount: number;
  totalPoints: number;
  attemptsUsed: number;
  bestScorePct: number | null;
  activeAttemptId: string | null;
  lastAttempt: {
    id: string;
    status: AttemptStatus;
    scorePct: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  } | null;
  canStart: boolean;
  blockedReason: 'MAX_ATTEMPTS' | 'COOLDOWN' | null;
  cooldownEndsAt: string | null;
}

export interface AttemptInProgress {
  id: string;
  status: 'IN_PROGRESS';
  assessmentId: string;
  assessmentTitle: string;
  attemptNumber: number;
  passingScorePct: number;
  startedAt: string;
  items: StudentItemView[];
  /** Saved answers keyed by itemId, for resume. */
  answers: Record<string, unknown>;
}

export interface ItemResult {
  itemId: string;
  order: number;
  type: AssessmentItemType;
  points: number;
  /** null while a reflection awaits manual grading. */
  earned: number | null;
  /** null for reflections (no binary correctness). */
  correct: boolean | null;
  /** FULL payload — answer keys and explanation are revealed after submission. */
  payload: unknown;
  answer: unknown;
  graderFeedback: string;
}

export interface AttemptResult {
  id: string;
  status: 'GRADING' | 'GRADED';
  assessmentId: string;
  assessmentTitle: string;
  attemptNumber: number;
  passingScorePct: number;
  scorePct: number | null;
  rawScore: number | null;
  maxScore: number | null;
  passed: boolean | null;
  submittedAt: string;
  gradedAt: string | null;
  pendingManualCount: number;
  items: ItemResult[];
}

export type AttemptView = AttemptInProgress | AttemptResult;

// ── Authoring ───────────────────────────────────────────────────────────────

export const upsertAssessmentRequestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  passingScorePct: z.number().int().min(1).max(100),
  maxAttempts: z.number().int().min(1).max(20).nullable(),
  cooldownMinutes: z.number().int().min(0).max(10_080),
  shuffleItems: z.boolean(),
});
export type UpsertAssessmentRequest = z.infer<typeof upsertAssessmentRequestSchema>;

export const authoringItemSchema = z.object({
  points: z.number().int().min(1).max(100),
  skillIds: z.array(z.string().min(1)).max(5),
  item: assessmentItemPayloadSchema,
});
export const replaceItemsRequestSchema = z.object({
  items: z.array(authoringItemSchema).max(50),
});
export type ReplaceItemsRequest = z.infer<typeof replaceItemsRequestSchema>;

export interface AssessmentAuthoringView {
  id: string;
  lessonId: string;
  title: string;
  passingScorePct: number;
  maxAttempts: number | null;
  cooldownMinutes: number;
  shuffleItems: boolean;
  items: Array<{
    id: string;
    order: number;
    points: number;
    skillIds: string[];
    item: AssessmentItemPayload;
  }>;
}

// ── Manual grading ──────────────────────────────────────────────────────────

export const gradeSubmissionRequestSchema = z.object({
  score: z.number().min(0),
  feedback: z.string().trim().max(4000),
});
export type GradeSubmissionRequest = z.infer<typeof gradeSubmissionRequestSchema>;

export interface GradingQueueEntry {
  attemptId: string;
  assessmentTitle: string;
  lessonTitle: string | null;
  studentName: string;
  submittedAt: string;
  pendingItems: number;
}

export interface GradingSubmissionView {
  submissionId: string;
  itemId: string;
  points: number;
  prompt: string;
  guidance: string | null;
  minWords: number | null;
  answerText: string;
  manualScore: number | null;
  graderFeedback: string;
}

export interface GradingAttemptDetail {
  attemptId: string;
  studentName: string;
  assessmentTitle: string;
  lessonTitle: string | null;
  submittedAt: string;
  reflections: GradingSubmissionView[];
}
