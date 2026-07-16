import type { Prisma } from '@prisma/client';
import type {
  ProjectBriefView,
  ProjectQueueEntry,
  ProjectReviewDetail,
  ProjectSubmissionView,
  SubmitProjectRequest,
} from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type { BriefSummary, ProjectRepository, SubmissionRow } from '../application/projectService';

type SubmissionWithRelations = Prisma.ProjectSubmissionGetPayload<{
  include: {
    reviewer: { select: { displayName: true } };
    scores: true;
    messages: {
      include: { author: { select: { displayName: true; role: true } } };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

function toSubmissionView(row: SubmissionWithRelations): ProjectSubmissionView {
  const earned =
    row.status === 'APPROVED'
      ? Math.round(row.scores.reduce((sum, score) => sum + score.points, 0) * 100) / 100
      : null;
  return {
    id: row.id,
    briefId: row.briefId,
    status: row.status,
    repoUrl: row.repoUrl,
    demoUrl: row.demoUrl,
    notes: row.notes,
    submissionRound: row.submissionRound,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewerName: row.reviewer?.displayName ?? null,
    scores: row.scores.map((score) => ({
      criterionId: score.criterionId,
      points: score.points,
      comment: score.comment,
    })),
    earnedPoints: earned,
    messages: row.messages.map((message) => ({
      id: message.id,
      authorName: message.author.displayName,
      authorRole: message.author.role,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

const SUBMISSION_INCLUDE = {
  reviewer: { select: { displayName: true } },
  scores: true,
  messages: {
    include: { author: { select: { displayName: true, role: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProjectSubmissionInclude;

function toBriefView(
  brief: Prisma.ProjectBriefGetPayload<{
    include: { rubric: true; topic: { select: { title: true } } };
  }>,
): ProjectBriefView {
  const rubric = [...brief.rubric].sort((a, b) => a.order - b.order);
  return {
    id: brief.id,
    topicId: brief.topicId,
    topicTitle: brief.topic.title,
    kind: brief.kind,
    title: brief.title,
    briefMd: brief.briefMd,
    rubric: rubric.map((criterion) => ({
      id: criterion.id,
      order: criterion.order,
      title: criterion.title,
      description: criterion.description,
      maxPoints: criterion.maxPoints,
    })),
    totalPoints: rubric.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
  };
}

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listBriefSummaries(): Promise<BriefSummary[]> {
    const briefs = await this.prisma.projectBrief.findMany({
      select: { id: true, topicId: true, kind: true, title: true },
    });
    return briefs.map((brief) => ({
      briefId: brief.id,
      topicId: brief.topicId,
      kind: brief.kind,
      title: brief.title,
    }));
  }

  async getBriefByTopic(topicId: string): Promise<ProjectBriefView | null> {
    const brief = await this.prisma.projectBrief.findUnique({
      where: { topicId },
      include: { rubric: true, topic: { select: { title: true } } },
    });
    return brief ? toBriefView(brief) : null;
  }

  async getBriefById(briefId: string): Promise<ProjectBriefView | null> {
    const brief = await this.prisma.projectBrief.findUnique({
      where: { id: briefId },
      include: { rubric: true, topic: { select: { title: true } } },
    });
    return brief ? toBriefView(brief) : null;
  }

  async findSubmissionRow(briefId: string, userId: string): Promise<SubmissionRow | null> {
    return this.prisma.projectSubmission.findUnique({
      where: { briefId_userId: { briefId, userId } },
      select: { id: true, briefId: true, userId: true, status: true },
    });
  }

  async getSubmissionView(briefId: string, userId: string): Promise<ProjectSubmissionView | null> {
    const row = await this.prisma.projectSubmission.findUnique({
      where: { briefId_userId: { briefId, userId } },
      include: SUBMISSION_INCLUDE,
    });
    return row ? toSubmissionView(row) : null;
  }

  async upsertSubmission(
    briefId: string,
    userId: string,
    data: SubmitProjectRequest,
    now: Date,
  ): Promise<{ id: string }> {
    const row = await this.prisma.projectSubmission.upsert({
      where: { briefId_userId: { briefId, userId } },
      create: { briefId, userId, ...data },
      update: {
        ...data,
        status: 'PENDING',
        submissionRound: { increment: 1 },
        submittedAt: now,
        reviewedAt: null,
      },
      select: { id: true },
    });
    return row;
  }

  async addMessage(submissionId: string, authorId: string, body: string): Promise<void> {
    await this.prisma.submissionMessage.create({ data: { submissionId, authorId, body } });
  }

  async listQueue(): Promise<ProjectQueueEntry[]> {
    const rows = await this.prisma.projectSubmission.findMany({
      where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
      orderBy: { submittedAt: 'asc' },
      include: {
        user: { select: { displayName: true } },
        brief: { include: { topic: { select: { title: true } } } },
      },
    });
    return rows.map((row) => ({
      submissionId: row.id,
      briefTitle: row.brief.title,
      topicTitle: row.brief.topic.title,
      kind: row.brief.kind,
      studentName: row.user.displayName,
      status: row.status,
      submissionRound: row.submissionRound,
      submittedAt: row.submittedAt.toISOString(),
    }));
  }

  async getReviewDetail(submissionId: string): Promise<ProjectReviewDetail | null> {
    const row = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
      include: {
        ...SUBMISSION_INCLUDE,
        user: { select: { displayName: true } },
        brief: { include: { rubric: true, topic: { select: { title: true } } } },
      },
    });
    if (!row) return null;
    return {
      submission: toSubmissionView(row),
      brief: toBriefView(row.brief),
      studentName: row.user.displayName,
    };
  }

  async getSubmissionRowById(submissionId: string) {
    const row = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        briefId: true,
        userId: true,
        status: true,
        brief: { select: { topicId: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      briefId: row.briefId,
      userId: row.userId,
      status: row.status,
      topicId: row.brief.topicId,
    };
  }

  async startReview(submissionId: string, reviewerId: string): Promise<boolean> {
    const updated = await this.prisma.projectSubmission.updateMany({
      where: { id: submissionId, status: 'PENDING' },
      data: { status: 'IN_REVIEW', reviewerId },
    });
    return updated.count === 1;
  }

  async requestChanges(submissionId: string, reviewerId: string, now: Date): Promise<boolean> {
    const updated = await this.prisma.projectSubmission.updateMany({
      where: { id: submissionId, status: 'IN_REVIEW' },
      data: { status: 'CHANGES_REQUESTED', reviewerId, reviewedAt: now },
    });
    return updated.count === 1;
  }

  async approve(
    submissionId: string,
    reviewerId: string,
    scores: Array<{ criterionId: string; points: number; comment: string }>,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectSubmission.updateMany({
        where: { id: submissionId, status: 'IN_REVIEW' },
        data: { status: 'APPROVED', reviewerId, reviewedAt: now },
      });
      if (updated.count === 0) return false;

      await tx.rubricScore.deleteMany({ where: { submissionId } });
      await tx.rubricScore.createMany({
        data: scores.map((score) => ({ submissionId, ...score })),
      });
      return true;
    });
  }
}
