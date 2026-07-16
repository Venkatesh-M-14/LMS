import type { PathStructure, RecordRow, Rule, UnitType } from '../domain/gating';

export interface LessonContext {
  lessonId: string;
  topicId: string;
  moduleId: string;
  published: boolean;
  hasQuiz: boolean;
}

export interface ProgressRepository {
  /** Ordered modules/topics/lessons of the active path (published flags included). */
  getPathStructure(): Promise<{ pathId: string; modules: PathStructure }>;
  getRules(): Promise<Rule[]>;
  getUserRecords(userId: string): Promise<RecordRow[]>;

  ensureEnrolled(userId: string, pathId: string): Promise<void>;
  findLessonContext(lessonId: string): Promise<LessonContext | null>;

  /** Creates an IN_PROGRESS record if none exists (never downgrades COMPLETED). */
  markInProgress(userId: string, unitType: UnitType, unitId: string): Promise<void>;

  /**
   * Marks a unit COMPLETED exactly once. Returns true only for the call that
   * performed the transition (atomic guard — concurrent callers get false).
   * Always keeps bestScorePct at the maximum seen.
   */
  completeUnit(
    userId: string,
    unitType: UnitType,
    unitId: string,
    scorePct: number | null,
  ): Promise<boolean>;
}
