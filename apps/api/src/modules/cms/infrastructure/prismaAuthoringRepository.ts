import { Prisma } from '@prisma/client';
import {
  CONTENT_BLOCK_PAYLOAD_SCHEMA_VERSION,
  type CmsLessonOverview,
  type ContentBlockInput,
  type LessonVersionDetail,
  type LessonVersionSummary,
  type SkillDto,
} from '@academy/shared';
import { ConflictError, NotFoundError } from '../../../core/errors/appError';
import type { PrismaClient } from '../../../core/db/prisma';
import type { AuthoringRepository, CreateLessonInput, VersionRow } from '../application/ports';

type VersionWithNames = Prisma.LessonVersionGetPayload<{
  include: {
    author: { select: { displayName: true } };
    reviewer: { select: { displayName: true } };
  };
}>;

function toVersionSummary(row: VersionWithNames): LessonVersionSummary {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    authorId: row.authorId,
    authorName: row.author.displayName,
    reviewerId: row.reviewerId,
    reviewerName: row.reviewer?.displayName ?? null,
    changelog: row.changelog,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

export class PrismaAuthoringRepository implements AuthoringRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listLessonOverviews(): Promise<CmsLessonOverview[]> {
    const lessons = await this.prisma.lesson.findMany({
      include: {
        topic: { include: { module: true } },
        skills: { include: { skill: true } },
        currentPublishedVersion: { select: { versionNumber: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            author: { select: { displayName: true } },
            reviewer: { select: { displayName: true } },
          },
        },
      },
      orderBy: [
        { topic: { module: { order: 'asc' } } },
        { topic: { order: 'asc' } },
        { order: 'asc' },
      ],
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      order: lesson.order,
      estimatedMinutes: lesson.estimatedMinutes,
      topicId: lesson.topicId,
      topicTitle: lesson.topic.title,
      topicDepth: lesson.topic.depth,
      moduleTitle: lesson.topic.module.title,
      skills: lesson.skills.map(({ skill }) => ({
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
      })),
      publishedVersionNumber: lesson.currentPublishedVersion?.versionNumber ?? null,
      latestVersion: lesson.versions[0] ? toVersionSummary(lesson.versions[0]) : null,
    }));
  }

  async listSkills(): Promise<SkillDto[]> {
    const skills = await this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
    return skills.map((skill) => ({ id: skill.id, slug: skill.slug, name: skill.name }));
  }

  async getVersionFacts(versionId: string): Promise<VersionRow | null> {
    const row = await this.prisma.lessonVersion.findUnique({
      where: { id: versionId },
      include: {
        _count: { select: { blocks: true } },
        lesson: { include: { _count: { select: { skills: true } } } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      lessonId: row.lessonId,
      versionNumber: row.versionNumber,
      status: row.status,
      authorId: row.authorId,
      blockCount: row._count.blocks,
      lessonSkillCount: row.lesson._count.skills,
    };
  }

  async getVersionDetail(versionId: string): Promise<LessonVersionDetail | null> {
    const row = await this.prisma.lessonVersion.findUnique({
      where: { id: versionId },
      include: {
        author: { select: { displayName: true } },
        reviewer: { select: { displayName: true } },
        lesson: { select: { title: true } },
        blocks: { orderBy: { order: 'asc' } },
      },
    });
    if (!row) return null;
    return {
      ...toVersionSummary(row),
      lessonId: row.lessonId,
      lessonTitle: row.lesson.title,
      blocks: row.blocks.map((block) => ({
        id: block.id,
        order: block.order,
        type: block.type,
        payload: block.payload,
        payloadSchemaVersion: block.payloadSchemaVersion,
      })),
    };
  }

  async listVersions(lessonId: string): Promise<LessonVersionSummary[]> {
    const rows = await this.prisma.lessonVersion.findMany({
      where: { lessonId },
      orderBy: { versionNumber: 'desc' },
      include: {
        author: { select: { displayName: true } },
        reviewer: { select: { displayName: true } },
      },
    });
    return rows.map(toVersionSummary);
  }

  async createLessonWithDraft(
    input: CreateLessonInput,
    authorId: string,
  ): Promise<CmsLessonOverview> {
    try {
      const lesson = await this.prisma.$transaction(async (tx) => {
        const maxOrder = await tx.lesson.aggregate({
          where: { topicId: input.topicId },
          _max: { order: true },
        });
        const created = await tx.lesson.create({
          data: {
            topicId: input.topicId,
            slug: input.slug,
            title: input.title,
            estimatedMinutes: input.estimatedMinutes,
            order: (maxOrder._max.order ?? 0) + 1,
          },
        });
        await tx.lessonVersion.create({
          data: { lessonId: created.id, versionNumber: 1, authorId },
        });
        return created;
      });

      const overviews = await this.listLessonOverviews();
      const overview = overviews.find((o) => o.id === lesson.id);
      if (!overview) throw new NotFoundError('Lesson vanished after creation');
      return overview;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictError('A lesson with this slug already exists in the topic');
        }
        if (error.code === 'P2003') {
          throw new NotFoundError('Topic not found');
        }
      }
      throw error;
    }
  }

  countOpenVersions(lessonId: string): Promise<number> {
    return this.prisma.lessonVersion.count({
      where: { lessonId, status: { in: ['DRAFT', 'IN_REVIEW'] } },
    });
  }

  async createDraft(
    lessonId: string,
    authorId: string,
    changelog: string,
  ): Promise<LessonVersionDetail> {
    const draft = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.lessonVersion.findFirst({
        where: { lessonId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const published = await tx.lessonVersion.findFirst({
        where: { lessonId, status: 'PUBLISHED' },
        include: { blocks: { orderBy: { order: 'asc' } } },
      });

      const created = await tx.lessonVersion.create({
        data: {
          lessonId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          authorId,
          changelog,
        },
      });

      if (published && published.blocks.length > 0) {
        await tx.contentBlock.createMany({
          data: published.blocks.map((block) => ({
            lessonVersionId: created.id,
            order: block.order,
            type: block.type,
            payload: block.payload as Prisma.InputJsonValue,
            payloadSchemaVersion: block.payloadSchemaVersion,
          })),
        });
      }
      return created;
    });

    const detail = await this.getVersionDetail(draft.id);
    if (!detail) throw new NotFoundError('Draft vanished after creation');
    return detail;
  }

  async replaceBlocks(versionId: string, blocks: ContentBlockInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.contentBlock.deleteMany({ where: { lessonVersionId: versionId } });
      if (blocks.length > 0) {
        await tx.contentBlock.createMany({
          data: blocks.map((block, index) => ({
            lessonVersionId: versionId,
            order: index + 1,
            type: block.type,
            payload: block.payload as Prisma.InputJsonValue,
            payloadSchemaVersion: CONTENT_BLOCK_PAYLOAD_SCHEMA_VERSION,
          })),
        });
      }
      await tx.lessonVersion.update({ where: { id: versionId }, data: { updatedAt: new Date() } });
    });
  }

  async markInReview(versionId: string): Promise<void> {
    await this.guardedTransition(versionId, 'DRAFT', { status: 'IN_REVIEW' });
  }

  async publish(versionId: string, reviewerId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const version = await tx.lessonVersion.findUnique({
        where: { id: versionId },
        select: { lessonId: true, status: true },
      });
      if (!version) throw new NotFoundError('Lesson version not found');
      if (version.status !== 'IN_REVIEW') {
        // Re-checked inside the transaction: two concurrent publishes race here.
        throw new ConflictError('Version is no longer in review');
      }

      await tx.lessonVersion.updateMany({
        where: { lessonId: version.lessonId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.lessonVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', reviewerId, publishedAt: new Date() },
      });
      await tx.lesson.update({
        where: { id: version.lessonId },
        data: { currentPublishedVersionId: versionId },
      });
    });
  }

  async rejectToDraft(versionId: string, reviewerId: string, reviewNotes: string): Promise<void> {
    await this.guardedTransition(versionId, 'IN_REVIEW', {
      status: 'DRAFT',
      reviewerId,
      reviewNotes,
    });
  }

  async lessonExists(lessonId: string): Promise<boolean> {
    const count = await this.prisma.lesson.count({ where: { id: lessonId } });
    return count > 0;
  }

  async setLessonSkills(lessonId: string, skillIds: string[]): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.lessonSkill.deleteMany({ where: { lessonId } });
        if (skillIds.length > 0) {
          await tx.lessonSkill.createMany({
            data: skillIds.map((skillId) => ({ lessonId, skillId })),
            skipDuplicates: true,
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundError('One of the skills does not exist');
      }
      throw error;
    }
  }

  /** Status transition with an optimistic re-check baked into the UPDATE. */
  private async guardedTransition(
    versionId: string,
    expectedStatus: 'DRAFT' | 'IN_REVIEW',
    data: Prisma.LessonVersionUncheckedUpdateManyInput,
  ): Promise<void> {
    const result = await this.prisma.lessonVersion.updateMany({
      where: { id: versionId, status: expectedStatus },
      data,
    });
    if (result.count === 0) {
      throw new ConflictError(`Version is no longer ${expectedStatus}`);
    }
  }
}
