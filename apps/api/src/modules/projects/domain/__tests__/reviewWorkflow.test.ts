import { ErrorCodes } from '@academy/shared';
import { AppError } from '../../../../core/errors/appError';
import {
  assertCanApprove,
  assertCanRequestChanges,
  assertCanStartReview,
  assertCanSubmit,
  validateRubricScores,
  type CriterionFacts,
} from '../reviewWorkflow';

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

describe('review state machine', () => {
  it('allows a first submission and a resubmission after changes were requested', () => {
    expect(codeOf(() => assertCanSubmit(null))).toBeNull();
    expect(codeOf(() => assertCanSubmit('CHANGES_REQUESTED'))).toBeNull();
  });

  it('blocks resubmitting while pending, in review, or after approval', () => {
    expect(codeOf(() => assertCanSubmit('PENDING'))).toBe(ErrorCodes.RESUBMIT_NOT_ALLOWED);
    expect(codeOf(() => assertCanSubmit('IN_REVIEW'))).toBe(ErrorCodes.RESUBMIT_NOT_ALLOWED);
    expect(codeOf(() => assertCanSubmit('APPROVED'))).toBe(ErrorCodes.RESUBMIT_NOT_ALLOWED);
  });

  it('start review only from PENDING', () => {
    expect(codeOf(() => assertCanStartReview('PENDING'))).toBeNull();
    expect(codeOf(() => assertCanStartReview('IN_REVIEW'))).toBe(
      ErrorCodes.REVIEW_INVALID_TRANSITION,
    );
    expect(codeOf(() => assertCanStartReview('APPROVED'))).toBe(
      ErrorCodes.REVIEW_INVALID_TRANSITION,
    );
  });

  it('request changes and approve only from IN_REVIEW', () => {
    expect(codeOf(() => assertCanRequestChanges('IN_REVIEW'))).toBeNull();
    expect(codeOf(() => assertCanApprove('IN_REVIEW'))).toBeNull();
    expect(codeOf(() => assertCanRequestChanges('PENDING'))).toBe(
      ErrorCodes.REVIEW_INVALID_TRANSITION,
    );
    expect(codeOf(() => assertCanApprove('CHANGES_REQUESTED'))).toBe(
      ErrorCodes.REVIEW_INVALID_TRANSITION,
    );
  });
});

describe('rubric validation', () => {
  const criteria: CriterionFacts[] = [
    { id: 'c1', title: 'Correctness', maxPoints: 10 },
    { id: 'c2', title: 'Clarity', maxPoints: 5 },
  ];

  it('returns the total when every criterion is scored within bounds', () => {
    const total = validateRubricScores(criteria, [
      { criterionId: 'c1', points: 8.5, comment: '' },
      { criterionId: 'c2', points: 5, comment: 'crisp' },
    ]);
    expect(total).toBe(13.5);
  });

  it('rejects a missing criterion score', () => {
    expect(
      codeOf(() => validateRubricScores(criteria, [{ criterionId: 'c1', points: 8, comment: '' }])),
    ).toBe(ErrorCodes.RUBRIC_INCOMPLETE);
  });

  it('rejects scores above the maximum or below zero', () => {
    expect(
      codeOf(() =>
        validateRubricScores(criteria, [
          { criterionId: 'c1', points: 11, comment: '' },
          { criterionId: 'c2', points: 5, comment: '' },
        ]),
      ),
    ).toBe(ErrorCodes.RUBRIC_SCORE_INVALID);
    expect(
      codeOf(() =>
        validateRubricScores(criteria, [
          { criterionId: 'c1', points: -1, comment: '' },
          { criterionId: 'c2', points: 5, comment: '' },
        ]),
      ),
    ).toBe(ErrorCodes.RUBRIC_SCORE_INVALID);
  });

  it('rejects duplicate and unknown criteria', () => {
    expect(
      codeOf(() =>
        validateRubricScores(criteria, [
          { criterionId: 'c1', points: 5, comment: '' },
          { criterionId: 'c1', points: 5, comment: '' },
        ]),
      ),
    ).toBe(ErrorCodes.RUBRIC_SCORE_INVALID);
    expect(
      codeOf(() =>
        validateRubricScores(criteria, [
          { criterionId: 'c1', points: 5, comment: '' },
          { criterionId: 'c2', points: 5, comment: '' },
          { criterionId: 'ghost', points: 1, comment: '' },
        ]),
      ),
    ).toBe(ErrorCodes.RUBRIC_SCORE_INVALID);
  });
});
