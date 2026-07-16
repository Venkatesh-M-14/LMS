import { Prisma } from '@prisma/client';
import type { RevisionAssignmentView } from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import { parseSnapshot } from '../../assessments/domain/snapshot';
import type { AdaptiveRepository, AttemptGradedFacts } from '../application/ports';
import type { GradedItem } from '../domain/weakness';

export class PrismaAdaptiveRepository implements AdaptiveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getAttemptGradedFacts(attemptId: string): Promise<AttemptGradedFacts | null> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        submissions: true,
        assessment: { select: { lessonId: true, lesson: { select: { title: true } } } },
      },
    });
    if (!attempt) return null;

    const snapshot = parseSnapshot(attempt.itemsSnapshot);
    const submissionByItem = new Map(attempt.submissions.map((s) => [s.itemId, s]));

    // Skill tags come from the live items (snapshots don't carry them). Items
    // edited/deleted after grading simply contribute no skills.
    const itemIds = snapshot.map((item) => item.itemId);
    const skillRows = await this.prisma.assessmentItemSkill.findMany({
      where: { itemId: { in: itemIds } },
      select: { itemId: true, skillId: true },
    });
    const skillsByItem = new Map<string, string[]>();
    for (const row of skillRows) {
      const list = skillsByItem.get(row.itemId) ?? [];
      list.push(row.skillId);
      skillsByItem.set(row.itemId, list);
    }

    const items: GradedItem[] = snapshot.map((item) => {
      const submission = submissionByItem.get(item.itemId);
      const earned = submission ? (submission.manualScore ?? submission.autoScore ?? 0) : 0;
      return {
        itemId: item.itemId,
        skillIds: skillsByItem.get(item.itemId) ?? [],
        earned,
        points: item.points,
      };
    });

    return {
      userId: attempt.userId,
      assessmentId: attempt.assessmentId,
      lessonId: attempt.assessment.lessonId,
      lessonTitle: attempt.assessment.lesson?.title ?? null,
      passed: attempt.passed ?? false,
      items,
    };
  }

  async findLessonForSkill(skillId: string): Promise<{ lessonId: string; title: string } | null> {
    // A published lesson tagged with this skill.
    const lessonSkill = await this.prisma.lessonSkill.findFirst({
      where: { skillId, lesson: { currentPublishedVersionId: { not: null } } },
      include: { lesson: { select: { id: true, title: true } } },
    });
    if (lessonSkill) {
      return { lessonId: lessonSkill.lesson.id, title: lessonSkill.lesson.title };
    }
    // Fall back to any published lesson in the skill's topic.
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      select: { topicId: true },
    });
    if (!skill?.topicId) return null;
    const lesson = await this.prisma.lesson.findFirst({
      where: { topicId: skill.topicId, currentPublishedVersionId: { not: null } },
      orderBy: { order: 'asc' },
      select: { id: true, title: true },
    });
    return lesson ? { lessonId: lesson.id, title: lesson.title } : null;
  }

  async createAssignment(input: {
    userId: string;
    assessmentId: string;
    skillId: string;
    targetLessonId: string;
    reason: string;
  }): Promise<boolean> {
    try {
      await this.prisma.revisionAssignment.create({ data: input });
      return true;
    } catch (error) {
      // Unique (user, assessment, skill): an open assignment already exists.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async listOpenBlocking(
    userId: string,
    assessmentId: string,
  ): Promise<Array<{ targetLessonId: string; targetLessonTitle: string }>> {
    const rows = await this.prisma.revisionAssignment.findMany({
      where: { userId, assessmentId, status: 'ASSIGNED', blocksRetake: true },
      include: { targetLesson: { select: { id: true, title: true } } },
    });
    // Distinct target lessons.
    const seen = new Map<string, string>();
    for (const row of rows) seen.set(row.targetLesson.id, row.targetLesson.title);
    return [...seen.entries()].map(([targetLessonId, targetLessonTitle]) => ({
      targetLessonId,
      targetLessonTitle,
    }));
  }

  async listAssignments(userId: string): Promise<RevisionAssignmentView[]> {
    const rows = await this.prisma.revisionAssignment.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        assessment: { select: { title: true } },
        skill: { select: { name: true } },
        targetLesson: { select: { id: true, title: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      assessmentId: row.assessmentId,
      assessmentTitle: row.assessment.title,
      skillName: row.skill.name,
      targetLessonId: row.targetLesson.id,
      targetLessonTitle: row.targetLesson.title,
      blocksRetake: row.blocksRetake,
      status: row.status,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async completeAssignmentsForLesson(userId: string, lessonId: string): Promise<void> {
    await this.prisma.revisionAssignment.updateMany({
      where: { userId, targetLessonId: lessonId, status: 'ASSIGNED' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
