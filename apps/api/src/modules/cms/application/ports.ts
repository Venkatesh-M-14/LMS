import type {
  CmsLessonOverview,
  ContentBlockInput,
  LessonVersionDetail,
  LessonVersionSummary,
  SkillDto,
} from '@academy/shared';

export interface VersionRow {
  id: string;
  lessonId: string;
  versionNumber: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  authorId: string;
  blockCount: number;
  lessonSkillCount: number;
}

export interface CreateLessonInput {
  topicId: string;
  slug: string;
  title: string;
  estimatedMinutes: number;
}

/**
 * Authoring persistence port. Mutations that must be atomic (create lesson +
 * first draft, publish + archive + pointer swap) are single methods — the
 * repository owns their transactions, the service owns the business rules.
 */
export interface AuthoringRepository {
  listLessonOverviews(): Promise<CmsLessonOverview[]>;
  listSkills(): Promise<SkillDto[]>;

  /** Compact facts for domain checks; null if the version does not exist. */
  getVersionFacts(versionId: string): Promise<VersionRow | null>;
  getVersionDetail(versionId: string): Promise<LessonVersionDetail | null>;
  listVersions(lessonId: string): Promise<LessonVersionSummary[]>;

  /** Creates the lesson together with an empty v1 DRAFT. */
  createLessonWithDraft(input: CreateLessonInput, authorId: string): Promise<CmsLessonOverview>;

  /** Next versionNumber, blocks copied from the current published version. */
  createDraft(lessonId: string, authorId: string, changelog: string): Promise<LessonVersionDetail>;
  countOpenVersions(lessonId: string): Promise<number>;

  replaceBlocks(versionId: string, blocks: ContentBlockInput[]): Promise<void>;
  markInReview(versionId: string): Promise<void>;

  /**
   * Atomically: archive the lesson's current PUBLISHED version (if any), mark
   * this one PUBLISHED with the reviewer, and repoint
   * lesson.currentPublishedVersionId.
   */
  publish(versionId: string, reviewerId: string): Promise<void>;
  rejectToDraft(versionId: string, reviewerId: string, reviewNotes: string): Promise<void>;

  lessonExists(lessonId: string): Promise<boolean>;
  setLessonSkills(lessonId: string, skillIds: string[]): Promise<void>;
}
