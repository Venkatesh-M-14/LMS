import { ErrorCodes, type RevisionAssignmentView } from '@academy/shared';
import { AppError } from '../../../core/errors/appError';
import type { Logger } from '../../../core/logging/logger';
import { detectWeakSkills } from '../domain/weakness';
import type { AdaptiveRepository } from './ports';

export interface AdaptiveServiceDeps {
  repo: AdaptiveRepository;
  logger?: Logger;
}

export class AdaptiveService {
  constructor(private readonly deps: AdaptiveServiceDeps) {}

  /**
   * Event subscriber. A failed attempt maps the learner's weak skills to
   * remedial lessons and creates blocking revision assignments — the next
   * retake is gated until they revisit that material.
   */
  async onAttemptGraded(event: { userId: string; attemptId: string; passed: boolean }): Promise<void> {
    if (event.passed) return;
    const facts = await this.deps.repo.getAttemptGradedFacts(event.attemptId);
    if (!facts || facts.passed) return;

    const weakSkills = detectWeakSkills(facts.items);
    for (const skillId of weakSkills) {
      // Prefer re-reading the lesson they just failed (always accessible);
      // fall back to any published lesson teaching the skill.
      const target =
        facts.lessonId !== null
          ? { lessonId: facts.lessonId }
          : await this.deps.repo.findLessonForSkill(skillId);
      if (!target) continue;
      await this.deps.repo.createAssignment({
        userId: facts.userId,
        assessmentId: facts.assessmentId,
        skillId,
        targetLessonId: target.lessonId,
        reason: 'Assigned after a missed question on this skill.',
      });
    }
    if (weakSkills.length > 0) {
      this.deps.logger?.info(
        { userId: facts.userId, assessmentId: facts.assessmentId, skills: weakSkills.length },
        'Revision assigned',
      );
    }
  }

  /**
   * Retake gate: a student with open blocking assignments for this assessment
   * must review the targeted lessons before attempting again.
   */
  async assertRetakeAllowed(userId: string, assessmentId: string): Promise<void> {
    const open = await this.deps.repo.listOpenBlocking(userId, assessmentId);
    if (open.length > 0) {
      const titles = open.map((a) => a.targetLessonTitle).join(', ');
      throw new AppError(
        ErrorCodes.REVISION_REQUIRED,
        409,
        `Review the assigned lesson(s) before retrying: ${titles}`,
        { details: open.map((a) => ({ path: a.targetLessonId, message: a.targetLessonTitle })) },
      );
    }
  }

  /** Called when a student opens a lesson — clears matching revision assignments. */
  async onLessonOpened(userId: string, lessonId: string): Promise<void> {
    await this.deps.repo.completeAssignmentsForLesson(userId, lessonId);
  }

  listAssignments(userId: string): Promise<RevisionAssignmentView[]> {
    return this.deps.repo.listAssignments(userId);
  }
}
