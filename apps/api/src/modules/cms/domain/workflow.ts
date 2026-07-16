import { ErrorCodes, type LessonVersionStatus, type Role } from '@academy/shared';
import { AppError } from '../../../core/errors/appError';

/**
 * The lesson-version state machine. Pure functions, no I/O — every rule about
 * who may move a version where lives here and nowhere else.
 *
 *   DRAFT ──submit──▶ IN_REVIEW ──publish──▶ PUBLISHED ──(republish)──▶ ARCHIVED
 *                         │
 *                       reject
 *                         ▼
 *                       DRAFT
 */

export interface VersionFacts {
  status: LessonVersionStatus;
  authorId: string;
  blockCount: number;
  lessonSkillCount: number;
}

export interface Actor {
  id: string;
  role: Role;
}

function transitionError(from: LessonVersionStatus, action: string): AppError {
  return new AppError(
    ErrorCodes.INVALID_STATUS_TRANSITION,
    409,
    `Cannot ${action} a version in status ${from}`,
  );
}

/** Blocks may only be edited while the version is a draft. */
export function assertEditable(version: VersionFacts): void {
  if (version.status !== 'DRAFT') {
    throw new AppError(
      ErrorCodes.VERSION_NOT_EDITABLE,
      409,
      `Only drafts can be edited — this version is ${version.status}`,
    );
  }
}

/** DRAFT → IN_REVIEW. Empty versions cannot advance. */
export function assertCanSubmit(version: VersionFacts): void {
  if (version.status !== 'DRAFT') {
    throw transitionError(version.status, 'submit');
  }
  if (version.blockCount === 0) {
    throw new AppError(
      ErrorCodes.EMPTY_VERSION_CANNOT_ADVANCE,
      422,
      'Add at least one content block before submitting for review',
    );
  }
}

/**
 * IN_REVIEW → PUBLISHED. Four-eyes rule: the reviewer must not be the author
 * (admins are exempt). Publishing also requires the lesson to be skill-tagged —
 * the adaptive-learning engine (M8) is only as good as these tags.
 */
export function assertCanPublish(version: VersionFacts, actor: Actor): void {
  if (version.status !== 'IN_REVIEW') {
    throw transitionError(version.status, 'publish');
  }
  if (actor.role !== 'ADMIN' && actor.id === version.authorId) {
    throw new AppError(
      ErrorCodes.REVIEWER_CANNOT_BE_AUTHOR,
      403,
      'A version must be published by someone other than its author',
    );
  }
  if (version.blockCount === 0) {
    throw new AppError(
      ErrorCodes.EMPTY_VERSION_CANNOT_ADVANCE,
      422,
      'An empty version cannot be published',
    );
  }
  if (version.lessonSkillCount === 0) {
    throw new AppError(
      ErrorCodes.SKILLS_REQUIRED_TO_PUBLISH,
      422,
      'Tag the lesson with at least one skill before publishing',
    );
  }
}

/** IN_REVIEW → DRAFT (reject with notes). */
export function assertCanReject(version: VersionFacts): void {
  if (version.status !== 'IN_REVIEW') {
    throw transitionError(version.status, 'reject');
  }
}

/** A lesson may have at most one open (DRAFT or IN_REVIEW) version at a time. */
export function assertNoOpenVersion(openCount: number): void {
  if (openCount > 0) {
    throw new AppError(
      ErrorCodes.OPEN_DRAFT_EXISTS,
      409,
      'This lesson already has an open draft or a version in review',
    );
  }
}
