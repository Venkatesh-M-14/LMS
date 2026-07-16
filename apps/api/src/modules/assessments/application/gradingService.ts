import {
  ErrorCodes,
  type GradeSubmissionRequest,
  type GradingAttemptDetail,
  type GradingQueueEntry,
} from '@academy/shared';
import { AppError, NotFoundError } from '../../../core/errors/appError';
import type { Clock } from '../../auth/application/ports';
import { roundScore } from '../domain/grading';
import { parseSnapshot, toTypedItem } from '../domain/snapshot';
import type { AttemptFinalizer } from './attemptFinalizer';
import type { AttemptRepository, GradingRepository } from './ports';

export interface GradingServiceDeps {
  grading: GradingRepository;
  attempts: AttemptRepository;
  finalizer: AttemptFinalizer;
  clock: Clock;
}

/** Instructor-side manual grading of reflection answers. */
export class GradingService {
  constructor(private readonly deps: GradingServiceDeps) {}

  async listQueue(): Promise<GradingQueueEntry[]> {
    const rows = await this.deps.grading.listQueue();
    return rows.map((row) => ({
      attemptId: row.attemptId,
      assessmentTitle: row.assessmentTitle,
      lessonTitle: row.lessonTitle,
      studentName: row.studentName,
      submittedAt: row.submittedAt.toISOString(),
      pendingItems: row.pendingItems,
    }));
  }

  async getDetail(attemptId: string): Promise<GradingAttemptDetail> {
    const detail = await this.deps.grading.getDetail(attemptId);
    if (!detail) throw new NotFoundError('Attempt not found');
    const { attempt } = detail;

    const snapshot = parseSnapshot(attempt.itemsSnapshot);
    const reflections = snapshot
      .filter((item) => item.type === 'REFLECTION')
      .sort((a, b) => a.order - b.order)
      .flatMap((item) => {
        const submission = attempt.submissions.find((s) => s.itemId === item.itemId);
        if (!submission || submission.autoScore !== null) return []; // auto-zeroed (unanswered)
        const typed = toTypedItem(item);
        if (typed.type !== 'REFLECTION') return [];
        const answer = submission.answer as { text?: string } | null;
        return [
          {
            submissionId: submission.id,
            itemId: item.itemId,
            points: item.points,
            prompt: typed.payload.prompt,
            guidance: typed.payload.guidance ?? null,
            minWords: typed.payload.minWords ?? null,
            answerText: answer?.text ?? '',
            manualScore: submission.manualScore,
            graderFeedback: submission.graderFeedback,
          },
        ];
      });

    return {
      attemptId: attempt.id,
      studentName: detail.studentName,
      assessmentTitle: detail.assessmentTitle,
      lessonTitle: detail.lessonTitle,
      submittedAt: attempt.submittedAt?.toISOString() ?? '',
      reflections,
    };
  }

  /**
   * Scores one reflection. When the attempt has no ungraded reflections left,
   * it is finalized: totals computed, GRADED, pass/fail decided.
   */
  async gradeSubmission(
    submissionId: string,
    graderId: string,
    request: GradeSubmissionRequest,
  ): Promise<void> {
    const submission = await this.deps.grading.findSubmission(submissionId);
    if (!submission) throw new NotFoundError('Submission not found');

    const attempt = await this.deps.attempts.findById(submission.attemptId);
    if (!attempt) throw new NotFoundError('Attempt not found');
    if (attempt.status !== 'GRADING') {
      throw new AppError(
        ErrorCodes.SUBMISSION_NOT_PENDING,
        409,
        'This attempt is not awaiting grading',
      );
    }

    const snapshot = parseSnapshot(attempt.itemsSnapshot);
    const item = snapshot.find((i) => i.itemId === submission.itemId);
    if (!item || item.type !== 'REFLECTION' || submission.autoScore !== null) {
      throw new AppError(
        ErrorCodes.SUBMISSION_NOT_PENDING,
        409,
        'This submission is not manually gradable',
      );
    }
    if (request.score > item.points) {
      throw new AppError(
        ErrorCodes.SCORE_EXCEEDS_POINTS,
        422,
        `Score cannot exceed the item's ${item.points} points`,
      );
    }

    const now = this.deps.clock.now();
    await this.deps.grading.setManualScore(
      submissionId,
      graderId,
      roundScore(request.score),
      request.feedback,
      now,
    );

    await this.deps.finalizer.finalizeIfComplete(attempt.id);
  }
}
