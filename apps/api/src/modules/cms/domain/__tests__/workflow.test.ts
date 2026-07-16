import { ErrorCodes } from '@academy/shared';
import { AppError } from '../../../../core/errors/appError';
import {
  assertCanPublish,
  assertCanReject,
  assertCanSubmit,
  assertEditable,
  assertNoOpenVersion,
  type Actor,
  type VersionFacts,
} from '../workflow';

function facts(overrides: Partial<VersionFacts> = {}): VersionFacts {
  return {
    status: 'DRAFT',
    authorId: 'author-1',
    blockCount: 3,
    lessonSkillCount: 1,
    ...overrides,
  };
}

const instructor: Actor = { id: 'reviewer-1', role: 'INSTRUCTOR' };
const authorAsActor: Actor = { id: 'author-1', role: 'INSTRUCTOR' };
const adminAuthor: Actor = { id: 'author-1', role: 'ADMIN' };

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

describe('assertEditable', () => {
  it('allows editing drafts', () => {
    expect(codeOf(() => assertEditable(facts()))).toBeNull();
  });

  it.each(['IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const)('rejects %s', (status) => {
    expect(codeOf(() => assertEditable(facts({ status })))).toBe(ErrorCodes.VERSION_NOT_EDITABLE);
  });
});

describe('assertCanSubmit', () => {
  it('allows a non-empty draft', () => {
    expect(codeOf(() => assertCanSubmit(facts()))).toBeNull();
  });

  it('rejects an empty draft', () => {
    expect(codeOf(() => assertCanSubmit(facts({ blockCount: 0 })))).toBe(
      ErrorCodes.EMPTY_VERSION_CANNOT_ADVANCE,
    );
  });

  it.each(['IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const)(
    'rejects submitting from %s',
    (status) => {
      expect(codeOf(() => assertCanSubmit(facts({ status })))).toBe(
        ErrorCodes.INVALID_STATUS_TRANSITION,
      );
    },
  );
});

describe('assertCanPublish', () => {
  it('allows a different instructor to publish an in-review version', () => {
    expect(codeOf(() => assertCanPublish(facts({ status: 'IN_REVIEW' }), instructor))).toBeNull();
  });

  it('blocks the author from publishing their own version (four-eyes)', () => {
    expect(codeOf(() => assertCanPublish(facts({ status: 'IN_REVIEW' }), authorAsActor))).toBe(
      ErrorCodes.REVIEWER_CANNOT_BE_AUTHOR,
    );
  });

  it('exempts admins from the four-eyes rule', () => {
    expect(codeOf(() => assertCanPublish(facts({ status: 'IN_REVIEW' }), adminAuthor))).toBeNull();
  });

  it('requires at least one skill tag', () => {
    expect(
      codeOf(() =>
        assertCanPublish(facts({ status: 'IN_REVIEW', lessonSkillCount: 0 }), instructor),
      ),
    ).toBe(ErrorCodes.SKILLS_REQUIRED_TO_PUBLISH);
  });

  it('rejects empty versions', () => {
    expect(
      codeOf(() => assertCanPublish(facts({ status: 'IN_REVIEW', blockCount: 0 }), instructor)),
    ).toBe(ErrorCodes.EMPTY_VERSION_CANNOT_ADVANCE);
  });

  it.each(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const)('rejects publishing from %s', (status) => {
    expect(codeOf(() => assertCanPublish(facts({ status }), instructor))).toBe(
      ErrorCodes.INVALID_STATUS_TRANSITION,
    );
  });
});

describe('assertCanReject', () => {
  it('allows rejecting an in-review version', () => {
    expect(codeOf(() => assertCanReject(facts({ status: 'IN_REVIEW' })))).toBeNull();
  });

  it.each(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const)('rejects rejecting from %s', (status) => {
    expect(codeOf(() => assertCanReject(facts({ status })))).toBe(
      ErrorCodes.INVALID_STATUS_TRANSITION,
    );
  });
});

describe('assertNoOpenVersion', () => {
  it('passes when no open versions exist', () => {
    expect(codeOf(() => assertNoOpenVersion(0))).toBeNull();
  });

  it('blocks when a draft or in-review version already exists', () => {
    expect(codeOf(() => assertNoOpenVersion(1))).toBe(ErrorCodes.OPEN_DRAFT_EXISTS);
  });
});
