import { Prisma } from '@prisma/client';
import {
  ASSESSMENT_ITEM_SCHEMA_VERSION,
  assessmentItemPayloadSchema,
  type AssessmentAuthoringView,
  type UpsertAssessmentRequest,
} from '@academy/shared';
import { NotFoundError } from '../../../core/errors/appError';
import type { PrismaClient } from '../../../core/db/prisma';
import type { SnapshotItem } from '../domain/snapshot';
import type {
  AssessmentRecord,
  AssessmentRepository,
  AttemptFactsRecord,
  AttemptRecord,
  AttemptRepository,
  AuthoringItemInput,
  FinalizeWrite,
  GradeWrite,
  GradingDetailRow,
  GradingQueueRow,
  GradingRepository,
  ItemRecord,
  SubmissionRecord,
} from '../application/ports';

export class PrismaAssessmentRepository implements AssessmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByLessonId(lessonId: string): Promise<AssessmentRecord | null> {
    return this.prisma.assessment.findUnique({ where: { lessonId } });
  }

  findById(assessmentId: string): Promise<AssessmentRecord | null> {
    return this.prisma.assessment.findUnique({ where: { id: assessmentId } });
  }

  async listItems(assessmentId: string): Promise<ItemRecord[]> {
    const items = await this.prisma.assessmentItem.findMany({
      where: { assessmentId },
      orderBy: { order: 'asc' },
    });
    return items.map((item) => ({
      id: item.id,
      order: item.order,
      type: item.type,
      points: item.points,
      payload: item.payload,
    }));
  }

  async getAuthoringView(lessonId: string): Promise<AssessmentAuthoringView | null> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { lessonId },
      include: {
        items: { orderBy: { order: 'asc' }, include: { skills: true } },
      },
    });
    if (!assessment || !assessment.lessonId) return null;
    return {
      id: assessment.id,
      lessonId: assessment.lessonId,
      title: assessment.title,
      passingScorePct: assessment.passingScorePct,
      maxAttempts: assessment.maxAttempts,
      cooldownMinutes: assessment.cooldownMinutes,
      shuffleItems: assessment.shuffleItems,
      items: assessment.items.map((item) => ({
        id: item.id,
        order: item.order,
        points: item.points,
        skillIds: item.skills.map((s) => s.skillId),
        item: assessmentItemPayloadSchema.parse({ type: item.type, payload: item.payload }),
      })),
    };
  }

  async upsertForLesson(
    lessonId: string,
    settings: UpsertAssessmentRequest,
  ): Promise<AssessmentRecord> {
    try {
      return await this.prisma.assessment.upsert({
        where: { lessonId },
        update: settings,
        create: { ...settings, lessonId, kind: 'LESSON_QUIZ' },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundError('Lesson not found');
      }
      throw error;
    }
  }

  async replaceItems(assessmentId: string, items: AuthoringItemInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentItem.deleteMany({ where: { assessmentId } });
      for (const [index, input] of items.entries()) {
        const created = await tx.assessmentItem.create({
          data: {
            assessmentId,
            order: index + 1,
            type: input.item.type,
            points: input.points,
            payload: input.item.payload as Prisma.InputJsonValue,
            payloadSchemaVersion: ASSESSMENT_ITEM_SCHEMA_VERSION,
          },
        });
        if (input.skillIds.length > 0) {
          await tx.assessmentItemSkill.createMany({
            data: input.skillIds.map((skillId) => ({ itemId: created.id, skillId })),
            skipDuplicates: true,
          });
        }
      }
    });
  }

  async getLessonPublishedVersionId(lessonId: string): Promise<string | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { currentPublishedVersionId: true },
    });
    return lesson?.currentPublishedVersionId ?? null;
  }
}

function toSubmissionRecord(row: {
  id: string;
  itemId: string;
  answer: unknown;
  autoScore: number | null;
  manualScore: number | null;
  graderFeedback: string;
}): SubmissionRecord {
  return {
    id: row.id,
    itemId: row.itemId,
    answer: row.answer,
    autoScore: row.autoScore,
    manualScore: row.manualScore,
    graderFeedback: row.graderFeedback,
  };
}

export class PrismaAttemptRepository implements AttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listFacts(userId: string, assessmentId: string): Promise<AttemptFactsRecord[]> {
    return this.prisma.attempt.findMany({
      where: { userId, assessmentId },
      select: { id: true, status: true, scorePct: true, passed: true, submittedAt: true },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  async findById(attemptId: string): Promise<AttemptRecord | null> {
    const row = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { submissions: true },
    });
    if (!row) return null;
    return { ...row, submissions: row.submissions.map(toSubmissionRecord) };
  }

  async create(input: {
    userId: string;
    assessmentId: string;
    attemptNumber: number;
    itemsSnapshot: SnapshotItem[];
    lessonVersionId: string | null;
  }): Promise<AttemptRecord> {
    const row = await this.prisma.attempt.create({
      data: {
        userId: input.userId,
        assessmentId: input.assessmentId,
        attemptNumber: input.attemptNumber,
        itemsSnapshot: input.itemsSnapshot as unknown as Prisma.InputJsonValue,
        lessonVersionId: input.lessonVersionId,
      },
      include: { submissions: true },
    });
    return { ...row, submissions: [] };
  }

  async upsertAnswers(
    attemptId: string,
    answers: Array<{ itemId: string; answer: unknown }>,
  ): Promise<void> {
    await this.prisma.$transaction(
      answers.map(({ itemId, answer }) =>
        this.prisma.itemSubmission.upsert({
          where: { attemptId_itemId: { attemptId, itemId } },
          update: { answer: answer as Prisma.InputJsonValue },
          create: { attemptId, itemId, answer: answer as Prisma.InputJsonValue },
        }),
      ),
    );
  }

  async applyGrading(
    attemptId: string,
    grades: GradeWrite[],
    finalize: FinalizeWrite,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const grade of grades) {
        await tx.itemSubmission.upsert({
          where: { attemptId_itemId: { attemptId, itemId: grade.itemId } },
          update: {
            answer: (grade.answer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            autoScore: grade.autoScore,
          },
          create: {
            attemptId,
            itemId: grade.itemId,
            answer: (grade.answer ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            autoScore: grade.autoScore,
          },
        });
      }
      await tx.attempt.update({
        where: { id: attemptId },
        data: finalize,
      });
    });
  }
}

export class PrismaGradingRepository implements GradingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listQueue(): Promise<GradingQueueRow[]> {
    const attempts = await this.prisma.attempt.findMany({
      where: { status: 'GRADING' },
      orderBy: { submittedAt: 'asc' },
      include: {
        user: { select: { displayName: true } },
        assessment: { include: { lesson: { select: { title: true } } } },
        submissions: { select: { autoScore: true, manualScore: true } },
      },
    });
    return attempts.map((attempt) => ({
      attemptId: attempt.id,
      assessmentTitle: attempt.assessment.title,
      lessonTitle: attempt.assessment.lesson?.title ?? null,
      studentName: attempt.user.displayName,
      submittedAt: attempt.submittedAt ?? attempt.startedAt,
      pendingItems: attempt.submissions.filter(
        (s) => s.autoScore === null && s.manualScore === null,
      ).length,
    }));
  }

  async getDetail(attemptId: string): Promise<GradingDetailRow | null> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        submissions: true,
        user: { select: { displayName: true } },
        assessment: { include: { lesson: { select: { title: true } } } },
      },
    });
    if (!attempt) return null;
    return {
      attempt: { ...attempt, submissions: attempt.submissions.map(toSubmissionRecord) },
      studentName: attempt.user.displayName,
      assessmentTitle: attempt.assessment.title,
      lessonTitle: attempt.assessment.lesson?.title ?? null,
    };
  }

  async findSubmission(
    submissionId: string,
  ): Promise<(SubmissionRecord & { attemptId: string }) | null> {
    const row = await this.prisma.itemSubmission.findUnique({ where: { id: submissionId } });
    if (!row) return null;
    return { ...toSubmissionRecord(row), attemptId: row.attemptId };
  }

  async setManualScore(
    submissionId: string,
    graderId: string,
    score: number,
    feedback: string,
    gradedAt: Date,
  ): Promise<void> {
    await this.prisma.itemSubmission.update({
      where: { id: submissionId },
      data: { manualScore: score, graderId, graderFeedback: feedback, gradedAt },
    });
  }

  async finalizeAttempt(
    attemptId: string,
    finalize: Omit<FinalizeWrite, 'submittedAt'>,
  ): Promise<void> {
    await this.prisma.attempt.update({ where: { id: attemptId }, data: finalize });
  }
}
