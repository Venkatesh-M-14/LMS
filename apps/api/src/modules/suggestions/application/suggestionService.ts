import {
  ErrorCodes,
  type CreateSuggestionRequest,
  type ReviewSuggestionRequest,
  type SuggestionStatus,
  type SuggestionView,
} from '@academy/shared';
import { AppError, NotFoundError } from '../../../core/errors/appError';
import type { EventBus } from '../../../core/events/eventBus';
import type { Logger } from '../../../core/logging/logger';
import type { AssessmentRepository } from '../../assessments/application/ports';
import type { SuggestionRepository } from './ports';

export interface SuggestionServiceDeps {
  repo: SuggestionRepository;
  assessments: AssessmentRepository;
  events?: EventBus;
  logger?: Logger;
}

/**
 * Students propose syllabus changes — a free-text idea, or a complete draft
 * question. Accepting a draft appends it to the target lesson's question bank,
 * so the reviewer's "accept" is the only step between a good suggestion and a
 * live question.
 */
export class SuggestionService {
  constructor(private readonly deps: SuggestionServiceDeps) {}

  async submit(userId: string, request: CreateSuggestionRequest): Promise<SuggestionView> {
    const suggestion = await this.deps.repo.create({
      userId,
      kind: request.kind,
      lessonId: request.lessonId ?? null,
      body: request.body ?? '',
      draft: request.kind === 'DRAFT_QUESTION' ? request.draft : null,
    });

    const authorName = (await this.deps.repo.authorName(userId)) ?? 'A member';
    await this.deps.events?.emit('SuggestionSubmitted', {
      suggestionId: suggestion.id,
      userId,
      authorName,
      kind: request.kind,
    });
    return suggestion;
  }

  listMine(userId: string): Promise<SuggestionView[]> {
    return this.deps.repo.listMine(userId);
  }

  listForReview(status: SuggestionStatus | null): Promise<SuggestionView[]> {
    return this.deps.repo.listForReview(status);
  }

  /**
   * Accept or reject. Accepting a DRAFT_QUESTION materialises it into the
   * lesson's bank first — if that fails, nothing is marked reviewed, so the
   * reviewer can retry rather than lose the suggestion.
   */
  async review(
    suggestionId: string,
    reviewerId: string,
    request: ReviewSuggestionRequest,
  ): Promise<void> {
    const row = await this.deps.repo.getRowById(suggestionId);
    if (!row) throw new NotFoundError('Suggestion not found');
    if (row.status !== 'PENDING') {
      throw new AppError(
        ErrorCodes.CONFLICT,
        409,
        'This suggestion has already been reviewed',
      );
    }

    const accepted = request.decision === 'ACCEPT';
    let createdItemId: string | null = null;

    if (accepted && row.kind === 'DRAFT_QUESTION' && row.draft && row.lessonId) {
      const assessment = await this.deps.assessments.findByLessonId(row.lessonId);
      if (!assessment) {
        throw new AppError(
          ErrorCodes.VALIDATION_FAILED,
          422,
          'This lesson has no quiz yet — create one before accepting a question into it',
        );
      }
      const item = await this.deps.assessments.appendItem(assessment.id, row.draft);
      createdItemId = item.id;
    }

    const transitioned = await this.deps.repo.markReviewed({
      id: suggestionId,
      reviewerId,
      accepted,
      adminNote: request.adminNote ?? null,
      createdItemId,
    });
    // Another reviewer won the race; the item append above is harmless.
    if (!transitioned) return;

    this.deps.logger?.info({ suggestionId, accepted, createdItemId }, 'Suggestion reviewed');
    await this.deps.events?.emit('SuggestionReviewed', {
      suggestionId,
      userId: row.userId,
      accepted,
      createdItemId,
    });
  }
}
