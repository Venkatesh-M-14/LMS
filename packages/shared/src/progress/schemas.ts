import { z } from 'zod';

/**
 * Progress & gating contracts. LOCKED/AVAILABLE are *derived* server-side from
 * prerequisite rules + completions; only IN_PROGRESS/COMPLETED are persisted.
 */

export const effectiveStatusSchema = z.enum(['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED']);
export type EffectiveStatus = z.infer<typeof effectiveStatusSchema>;

export interface UnitProgress {
  status: EffectiveStatus;
  bestScorePct: number | null;
}

/** Per-user progress across the whole path, keyed by unit ids. */
export interface ProgressMap {
  lessons: Record<string, UnitProgress>;
  topics: Record<string, UnitProgress>;
  modules: Record<string, UnitProgress>;
  /** The first available-or-in-progress lesson in path order — "continue here". */
  nextLessonId: string | null;
  completedLessons: number;
  totalLessons: number;
}

export interface LessonCompletionResult {
  lessonCompleted: boolean;
  topicCompleted: boolean;
  moduleCompleted: boolean;
}
