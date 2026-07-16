import type {
  AssessmentAuthoringView,
  ChallengeSummary,
  ReplaceItemsRequest,
  UpsertAssessmentRequest,
} from '@academy/shared';
import { NotFoundError } from '../../../core/errors/appError';
import type { AssessmentRepository } from './ports';

/**
 * Instructor-side assessment authoring. Deliberately snapshot-safe: editing
 * items never touches existing attempts — they graded (and will grade)
 * against their own frozen snapshots.
 */
export class AssessmentAuthoringService {
  constructor(private readonly repo: AssessmentRepository) {}

  getForLesson(lessonId: string): Promise<AssessmentAuthoringView | null> {
    return this.repo.getAuthoringView(lessonId);
  }

  listChallenges(): Promise<ChallengeSummary[]> {
    return this.repo.listChallenges();
  }

  async upsertForLesson(
    lessonId: string,
    settings: UpsertAssessmentRequest,
  ): Promise<AssessmentAuthoringView> {
    await this.repo.upsertForLesson(lessonId, settings);
    const view = await this.repo.getAuthoringView(lessonId);
    if (!view) throw new NotFoundError('Assessment vanished after upsert');
    return view;
  }

  async replaceItems(assessmentId: string, request: ReplaceItemsRequest): Promise<void> {
    const assessment = await this.repo.findById(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment not found');
    await this.repo.replaceItems(assessmentId, request.items);
  }
}
