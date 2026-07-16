import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../../core/errors/appError';
import type { PrismaClient } from '../../../core/db/prisma';
import type { PathStructure, RecordRow, Rule, UnitType } from '../domain/gating';
import type { LessonContext, ProgressRepository } from '../application/ports';

export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPathStructure(): Promise<{ pathId: string; modules: PathStructure }> {
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
                  select: { id: true, order: true, currentPublishedVersionId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!path) throw new NotFoundError('No active learning path');

    return {
      pathId: path.id,
      modules: path.modules.map((module) => ({
        id: module.id,
        order: module.order,
        topics: module.topics.map((topic) => ({
          id: topic.id,
          order: topic.order,
          lessons: topic.lessons.map((lesson) => ({
            id: lesson.id,
            order: lesson.order,
            published: lesson.currentPublishedVersionId !== null,
          })),
        })),
      })),
    };
  }

  getRules(): Promise<Rule[]> {
    return this.prisma.prerequisiteRule.findMany({
      select: {
        unitType: true,
        unitId: true,
        requiredUnitType: true,
        requiredUnitId: true,
        minScorePct: true,
      },
    });
  }

  getUserRecords(userId: string): Promise<RecordRow[]> {
    return this.prisma.progressRecord.findMany({
      where: { userId },
      select: { unitType: true, unitId: true, status: true, bestScorePct: true },
    });
  }

  async ensureEnrolled(userId: string, pathId: string): Promise<void> {
    await this.prisma.enrollment.upsert({
      where: { userId_pathId: { userId, pathId } },
      update: {},
      create: { userId, pathId },
    });
  }

  async findLessonContext(lessonId: string): Promise<LessonContext | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        topicId: true,
        currentPublishedVersionId: true,
        topic: { select: { moduleId: true } },
        assessment: { select: { id: true, items: { select: { id: true }, take: 1 } } },
      },
    });
    if (!lesson) return null;
    return {
      lessonId: lesson.id,
      topicId: lesson.topicId,
      moduleId: lesson.topic.moduleId,
      published: lesson.currentPublishedVersionId !== null,
      hasQuiz: (lesson.assessment?.items.length ?? 0) > 0,
    };
  }

  async markInProgress(userId: string, unitType: UnitType, unitId: string): Promise<void> {
    try {
      await this.prisma.progressRecord.upsert({
        where: { userId_unitType_unitId: { userId, unitType, unitId } },
        update: {}, // never downgrade an existing record
        create: { userId, unitType, unitId, status: 'IN_PROGRESS' },
      });
    } catch (error) {
      // Benign create race between two parallel opens.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  async completeUnit(
    userId: string,
    unitType: UnitType,
    unitId: string,
    scorePct: number | null,
  ): Promise<boolean> {
    const now = new Date();

    // Atomic transition guard: only ONE caller flips a row to COMPLETED.
    const transitioned = await this.prisma.progressRecord.updateMany({
      where: { userId, unitType, unitId, status: { not: 'COMPLETED' } },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        ...(scorePct !== null ? { bestScorePct: scorePct } : {}),
      },
    });
    if (transitioned.count === 1) return true;

    // No transition: either no row yet, or it was already COMPLETED.
    try {
      await this.prisma.progressRecord.create({
        data: {
          userId,
          unitType,
          unitId,
          status: 'COMPLETED',
          completedAt: now,
          bestScorePct: scorePct,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Already completed (possibly by a concurrent caller): keep best score.
        if (scorePct !== null) {
          await this.prisma.progressRecord.updateMany({
            where: {
              userId,
              unitType,
              unitId,
              OR: [{ bestScorePct: null }, { bestScorePct: { lt: scorePct } }],
            },
            data: { bestScorePct: scorePct },
          });
        }
        return false;
      }
      throw error;
    }
  }
}
