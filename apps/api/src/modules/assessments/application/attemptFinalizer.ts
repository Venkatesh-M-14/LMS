import type { Clock } from '../../auth/application/ports';
import type { EventBus } from '../../../core/events/eventBus';
import { roundScore, toScorePct } from '../domain/grading';
import { parseSnapshot } from '../domain/snapshot';
import type { AssessmentRepository, AttemptRepository, GradingRepository } from './ports';

export interface AttemptFinalizerDeps {
  attempts: AttemptRepository;
  assessments: AssessmentRepository;
  grading: GradingRepository;
  clock: Clock;
  events?: EventBus;
}

/**
 * The single place a GRADING attempt becomes GRADED. Both async graders call
 * it after writing their score — the manual-grading flow (reflections) and
 * the judge worker (coding runs). Whichever writes the last pending score
 * finalizes; the check is repeatable and idempotent.
 */
export class AttemptFinalizer {
  constructor(private readonly deps: AttemptFinalizerDeps) {}

  async finalizeIfComplete(attemptId: string): Promise<boolean> {
    const attempt = await this.deps.attempts.findById(attemptId);
    if (!attempt || attempt.status !== 'GRADING') return false;

    const stillPending = attempt.submissions.some(
      (submission) => submission.autoScore === null && submission.manualScore === null,
    );
    if (stillPending) return false;

    const assessment = await this.deps.assessments.findById(attempt.assessmentId);
    if (!assessment) return false;

    const snapshot = parseSnapshot(attempt.itemsSnapshot);
    const maxScore = snapshot.reduce((sum, item) => sum + item.points, 0);
    const rawScore = roundScore(
      attempt.submissions.reduce(
        (sum, submission) => sum + (submission.manualScore ?? submission.autoScore ?? 0),
        0,
      ),
    );
    const scorePct = toScorePct(rawScore, maxScore);
    const passed = scorePct >= assessment.passingScorePct;

    await this.deps.grading.finalizeAttempt(attemptId, {
      status: 'GRADED',
      rawScore,
      maxScore,
      scorePct,
      passed,
      gradedAt: this.deps.clock.now(),
    });

    if (this.deps.events) {
      await this.deps.events.emit('AttemptGraded', {
        userId: attempt.userId,
        assessmentId: assessment.id,
        lessonId: assessment.lessonId,
        passed,
        scorePct,
      });
    }
    return true;
  }
}
