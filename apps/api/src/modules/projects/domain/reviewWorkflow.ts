import { ErrorCodes, type ReviewStatus } from '@academy/shared';
import { AppError } from '../../../core/errors/appError';

/**
 * The project review state machine — every rule about who may move a
 * submission where lives here.
 *
 *   (new) ──submit──▶ PENDING ──start review──▶ IN_REVIEW ──┬─▶ APPROVED (terminal)
 *      ▲                                                    └─▶ CHANGES_REQUESTED
 *      └───────────────── resubmit ◀────────────────────────────────┘
 */

export function assertCanSubmit(existingStatus: ReviewStatus | null): void {
  if (existingStatus === null) return; // first submission
  if (existingStatus === 'CHANGES_REQUESTED') return; // resubmission
  const message =
    existingStatus === 'APPROVED'
      ? 'This project is already approved'
      : 'This submission is being reviewed — wait for feedback before resubmitting';
  throw new AppError(ErrorCodes.RESUBMIT_NOT_ALLOWED, 409, message);
}

function transitionError(from: ReviewStatus, action: string): AppError {
  return new AppError(
    ErrorCodes.REVIEW_INVALID_TRANSITION,
    409,
    `Cannot ${action} a submission in status ${from}`,
  );
}

export function assertCanStartReview(status: ReviewStatus): void {
  if (status !== 'PENDING') throw transitionError(status, 'start reviewing');
}

export function assertCanRequestChanges(status: ReviewStatus): void {
  if (status !== 'IN_REVIEW') throw transitionError(status, 'request changes on');
}

export function assertCanApprove(status: ReviewStatus): void {
  if (status !== 'IN_REVIEW') throw transitionError(status, 'approve');
}

export interface CriterionFacts {
  id: string;
  title: string;
  maxPoints: number;
}

export interface ScoreInput {
  criterionId: string;
  points: number;
  comment: string;
}

/**
 * Approving requires every rubric criterion scored exactly once, each within
 * its maximum. Returns the earned total.
 */
export function validateRubricScores(criteria: CriterionFacts[], scores: ScoreInput[]): number {
  const scoreByCriterion = new Map(scores.map((score) => [score.criterionId, score]));

  if (scoreByCriterion.size !== scores.length) {
    throw new AppError(ErrorCodes.RUBRIC_SCORE_INVALID, 422, 'Duplicate rubric scores');
  }

  let total = 0;
  for (const criterion of criteria) {
    const score = scoreByCriterion.get(criterion.id);
    if (!score) {
      throw new AppError(
        ErrorCodes.RUBRIC_INCOMPLETE,
        422,
        `Missing score for criterion "${criterion.title}"`,
      );
    }
    if (score.points < 0 || score.points > criterion.maxPoints) {
      throw new AppError(
        ErrorCodes.RUBRIC_SCORE_INVALID,
        422,
        `"${criterion.title}" must be scored between 0 and ${criterion.maxPoints}`,
      );
    }
    total += score.points;
    scoreByCriterion.delete(criterion.id);
  }

  if (scoreByCriterion.size > 0) {
    throw new AppError(ErrorCodes.RUBRIC_SCORE_INVALID, 422, 'Scores reference unknown criteria');
  }
  return Math.round(total * 100) / 100;
}
