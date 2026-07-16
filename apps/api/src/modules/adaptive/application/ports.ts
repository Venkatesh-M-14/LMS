import type { RevisionAssignmentView } from '@academy/shared';
import type { GradedItem } from '../domain/weakness';

export interface AttemptGradedFacts {
  userId: string;
  assessmentId: string;
  /** The lesson the failed assessment belongs to — always accessible to the
   * learner (they took its quiz), so it's the natural remediation target. */
  lessonId: string | null;
  passed: boolean;
  items: GradedItem[];
}

export interface AdaptiveRepository {
  /** Per-item earned/points + skill tags for a graded attempt (null if gone). */
  getAttemptGradedFacts(attemptId: string): Promise<AttemptGradedFacts | null>;

  /** A published lesson that teaches the skill (for remediation), or null. */
  findLessonForSkill(skillId: string): Promise<{ lessonId: string; title: string } | null>;

  /** Idempotently create an ASSIGNED assignment (unique per user/assessment/skill). */
  createAssignment(input: {
    userId: string;
    assessmentId: string;
    skillId: string;
    targetLessonId: string;
    reason: string;
  }): Promise<void>;

  /** Open (ASSIGNED) blocking assignments for a user's assessment. */
  listOpenBlocking(
    userId: string,
    assessmentId: string,
  ): Promise<Array<{ targetLessonId: string; targetLessonTitle: string }>>;

  listAssignments(userId: string): Promise<RevisionAssignmentView[]>;

  /** Marks any ASSIGNED assignments targeting this lesson COMPLETED. */
  completeAssignmentsForLesson(userId: string, lessonId: string): Promise<void>;
}
