import type {
  CmsLessonOverview,
  CreateLessonRequest,
  LessonVersionDetail,
  LessonVersionSummary,
  ReplaceBlocksRequest,
  SkillDto,
} from '@academy/shared';
import { NotFoundError } from '../../../core/errors/appError';
import {
  assertCanPublish,
  assertCanReject,
  assertCanSubmit,
  assertEditable,
  assertNoOpenVersion,
  type Actor,
} from '../domain/workflow';
import type { AuthoringRepository, VersionRow } from './ports';

/**
 * Application service for lesson authoring. Every method: load facts →
 * enforce domain rules → delegate the (transactional) mutation to the port.
 */
export class LessonAuthoringService {
  constructor(private readonly repo: AuthoringRepository) {}

  listLessons(): Promise<CmsLessonOverview[]> {
    return this.repo.listLessonOverviews();
  }

  listSkills(): Promise<SkillDto[]> {
    return this.repo.listSkills();
  }

  createLesson(input: CreateLessonRequest, actor: Actor): Promise<CmsLessonOverview> {
    // Topic existence and slug uniqueness are enforced by the repository
    // (FK + unique constraints translated to NotFound/Conflict).
    return this.repo.createLessonWithDraft(input, actor.id);
  }

  async listVersions(lessonId: string): Promise<LessonVersionSummary[]> {
    if (!(await this.repo.lessonExists(lessonId))) {
      throw new NotFoundError('Lesson not found');
    }
    return this.repo.listVersions(lessonId);
  }

  async getVersion(versionId: string): Promise<LessonVersionDetail> {
    const detail = await this.repo.getVersionDetail(versionId);
    if (!detail) throw new NotFoundError('Lesson version not found');
    return detail;
  }

  async createDraft(
    lessonId: string,
    changelog: string,
    actor: Actor,
  ): Promise<LessonVersionDetail> {
    if (!(await this.repo.lessonExists(lessonId))) {
      throw new NotFoundError('Lesson not found');
    }
    assertNoOpenVersion(await this.repo.countOpenVersions(lessonId));
    return this.repo.createDraft(lessonId, actor.id, changelog);
  }

  async replaceBlocks(
    versionId: string,
    request: ReplaceBlocksRequest,
  ): Promise<LessonVersionDetail> {
    const facts = await this.mustGetFacts(versionId);
    assertEditable(facts);
    await this.repo.replaceBlocks(versionId, request.blocks);
    return this.getVersion(versionId);
  }

  async submit(versionId: string): Promise<LessonVersionDetail> {
    const facts = await this.mustGetFacts(versionId);
    assertCanSubmit(facts);
    await this.repo.markInReview(versionId);
    return this.getVersion(versionId);
  }

  async publish(versionId: string, actor: Actor): Promise<LessonVersionDetail> {
    const facts = await this.mustGetFacts(versionId);
    assertCanPublish(facts, actor);
    await this.repo.publish(versionId, actor.id);
    return this.getVersion(versionId);
  }

  async reject(versionId: string, reviewNotes: string, actor: Actor): Promise<LessonVersionDetail> {
    const facts = await this.mustGetFacts(versionId);
    assertCanReject(facts);
    await this.repo.rejectToDraft(versionId, actor.id, reviewNotes);
    return this.getVersion(versionId);
  }

  async setLessonSkills(lessonId: string, skillIds: string[]): Promise<void> {
    if (!(await this.repo.lessonExists(lessonId))) {
      throw new NotFoundError('Lesson not found');
    }
    await this.repo.setLessonSkills(lessonId, skillIds);
  }

  private async mustGetFacts(versionId: string): Promise<VersionRow> {
    const facts = await this.repo.getVersionFacts(versionId);
    if (!facts) throw new NotFoundError('Lesson version not found');
    return facts;
  }
}
