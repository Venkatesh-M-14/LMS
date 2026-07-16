import { ErrorCodes, type LessonRead, type PathTree } from '@academy/shared';
import { AppError, NotFoundError } from '../../../core/errors/appError';
import type { PrismaClient } from '../../../core/db/prisma';

/**
 * Student-facing read model. Thin by design (no domain layer): these are
 * pure projections of published content. Students never see draft data —
 * every query here goes through the currentPublishedVersion pointer.
 */
export class CurriculumQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPathTree(): Promise<PathTree> {
    const path = await this.prisma.path.findFirst({
      where: { isActive: true },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            topics: {
              orderBy: { order: 'asc' },
              include: {
                lessons: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    order: true,
                    estimatedMinutes: true,
                    currentPublishedVersionId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!path) throw new NotFoundError('No active learning path');

    return {
      id: path.id,
      slug: path.slug,
      title: path.title,
      description: path.description,
      modules: path.modules.map((module) => ({
        id: module.id,
        slug: module.slug,
        title: module.title,
        description: module.description,
        order: module.order,
        topics: module.topics.map((topic) => ({
          id: topic.id,
          slug: topic.slug,
          title: topic.title,
          description: topic.description,
          order: topic.order,
          depth: topic.depth,
          lessons: topic.lessons.map((lesson) => ({
            id: lesson.id,
            slug: lesson.slug,
            title: lesson.title,
            order: lesson.order,
            estimatedMinutes: lesson.estimatedMinutes,
            isPublished: lesson.currentPublishedVersionId !== null,
          })),
        })),
      })),
    };
  }

  /**
   * The full published content of one lesson. The response carries the
   * concrete versionId/versionNumber it was read from: a republish never
   * mutates a payload someone already fetched.
   */
  async getLessonRead(lessonId: string): Promise<LessonRead> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        topic: { include: { module: true } },
        skills: { include: { skill: true } },
        currentPublishedVersion: { include: { blocks: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!lesson) throw new NotFoundError('Lesson not found');

    const version = lesson.currentPublishedVersion;
    if (!version || !version.publishedAt) {
      throw new AppError(
        ErrorCodes.LESSON_NOT_PUBLISHED,
        404,
        'This lesson has no published content yet',
      );
    }

    return {
      lessonId: lesson.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
      slug: lesson.slug,
      title: lesson.title,
      estimatedMinutes: lesson.estimatedMinutes,
      topic: { id: lesson.topic.id, slug: lesson.topic.slug, title: lesson.topic.title },
      module: {
        id: lesson.topic.module.id,
        slug: lesson.topic.module.slug,
        title: lesson.topic.module.title,
      },
      skills: lesson.skills.map(({ skill }) => ({
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
      })),
      blocks: version.blocks.map((block) => ({
        id: block.id,
        order: block.order,
        type: block.type,
        payload: block.payload,
        payloadSchemaVersion: block.payloadSchemaVersion,
      })),
      publishedAt: version.publishedAt.toISOString(),
    };
  }
}
