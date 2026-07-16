import type {
  ApproveProjectRequest,
  ProjectBriefView,
  ProjectQueueEntry,
  ProjectReviewDetail,
  ProjectSubmissionView,
  ProjectView,
  Role,
  SubmitProjectRequest,
} from '@academy/shared';
import { ForbiddenError, NotFoundError } from '../../../core/errors/appError';
import type { Clock } from '../../auth/application/ports';
import type { EventBus } from '../../../core/events/eventBus';
import {
  assertCanApprove,
  assertCanRequestChanges,
  assertCanStartReview,
  assertCanSubmit,
  validateRubricScores,
} from '../domain/reviewWorkflow';

export interface Actor {
  id: string;
  role: Role;
}

export interface BriefSummary {
  briefId: string;
  topicId: string;
  kind: 'MINI_PROJECT' | 'MACHINE_CODING';
  title: string;
}

export interface SubmissionRow {
  id: string;
  briefId: string;
  userId: string;
  status: 'PENDING' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED';
}

export interface ProjectRepository {
  listBriefSummaries(): Promise<BriefSummary[]>;
  getBriefByTopic(topicId: string): Promise<ProjectBriefView | null>;
  getBriefById(briefId: string): Promise<ProjectBriefView | null>;

  findSubmissionRow(briefId: string, userId: string): Promise<SubmissionRow | null>;
  getSubmissionView(briefId: string, userId: string): Promise<ProjectSubmissionView | null>;
  /** Insert or (on resubmission) reset to PENDING with round + 1. */
  upsertSubmission(
    briefId: string,
    userId: string,
    data: SubmitProjectRequest,
    now: Date,
  ): Promise<{ id: string }>;
  addMessage(submissionId: string, authorId: string, body: string): Promise<void>;

  listQueue(): Promise<ProjectQueueEntry[]>;
  getReviewDetail(submissionId: string): Promise<ProjectReviewDetail | null>;
  getSubmissionRowById(submissionId: string): Promise<(SubmissionRow & { topicId: string }) | null>;
  /** Guarded transitions: return false when the expected status was lost. */
  startReview(submissionId: string, reviewerId: string): Promise<boolean>;
  requestChanges(submissionId: string, reviewerId: string, now: Date): Promise<boolean>;
  approve(
    submissionId: string,
    reviewerId: string,
    scores: Array<{ criterionId: string; points: number; comment: string }>,
    now: Date,
  ): Promise<boolean>;
}

export interface TopicGate {
  assertTopicAccessible(actor: Actor, topicId: string): Promise<void>;
}

export interface ProjectServiceDeps {
  repo: ProjectRepository;
  gate: TopicGate;
  clock: Clock;
  events?: EventBus;
}

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  // ── Student ───────────────────────────────────────────────────────────────

  listBriefSummaries(): Promise<BriefSummary[]> {
    return this.deps.repo.listBriefSummaries();
  }

  async getProjectForTopic(actor: Actor, topicId: string): Promise<ProjectView> {
    const brief = await this.deps.repo.getBriefByTopic(topicId);
    if (!brief) throw new NotFoundError('This topic has no project');
    await this.deps.gate.assertTopicAccessible(actor, topicId);
    const submission = await this.deps.repo.getSubmissionView(brief.id, actor.id);
    return { brief, submission };
  }

  async submit(actor: Actor, briefId: string, request: SubmitProjectRequest): Promise<ProjectView> {
    const brief = await this.deps.repo.getBriefById(briefId);
    if (!brief) throw new NotFoundError('Project not found');
    await this.deps.gate.assertTopicAccessible(actor, brief.topicId);

    const existing = await this.deps.repo.findSubmissionRow(briefId, actor.id);
    assertCanSubmit(existing?.status ?? null);

    const { id } = await this.deps.repo.upsertSubmission(
      briefId,
      actor.id,
      request,
      this.deps.clock.now(),
    );
    if (existing) {
      await this.deps.repo.addMessage(
        id,
        actor.id,
        request.notes ? `Resubmitted: ${request.notes}` : 'Resubmitted after requested changes.',
      );
    }
    return this.getProjectForTopic(actor, brief.topicId);
  }

  async addStudentMessage(actor: Actor, submissionId: string, body: string): Promise<void> {
    const row = await this.deps.repo.getSubmissionRowById(submissionId);
    if (!row) throw new NotFoundError('Submission not found');
    if (row.userId !== actor.id) throw new ForbiddenError();
    await this.deps.repo.addMessage(submissionId, actor.id, body);
  }

  // ── Instructor ────────────────────────────────────────────────────────────

  listQueue(): Promise<ProjectQueueEntry[]> {
    return this.deps.repo.listQueue();
  }

  async getReviewDetail(submissionId: string): Promise<ProjectReviewDetail> {
    const detail = await this.deps.repo.getReviewDetail(submissionId);
    if (!detail) throw new NotFoundError('Submission not found');
    return detail;
  }

  async startReview(actor: Actor, submissionId: string): Promise<void> {
    const row = await this.mustGetRow(submissionId);
    assertCanStartReview(row.status);
    await this.deps.repo.startReview(submissionId, actor.id);
  }

  async requestChanges(actor: Actor, submissionId: string, message: string): Promise<void> {
    const row = await this.mustGetRow(submissionId);
    assertCanRequestChanges(row.status);
    await this.deps.repo.addMessage(submissionId, actor.id, message);
    await this.deps.repo.requestChanges(submissionId, actor.id, this.deps.clock.now());
  }

  async approve(actor: Actor, submissionId: string, request: ApproveProjectRequest): Promise<void> {
    const row = await this.mustGetRow(submissionId);
    assertCanApprove(row.status);

    const brief = await this.deps.repo.getBriefById(row.briefId);
    if (!brief) throw new NotFoundError('Project brief not found');
    validateRubricScores(brief.rubric, request.scores);

    if (request.message) {
      await this.deps.repo.addMessage(submissionId, actor.id, request.message);
    }
    const approved = await this.deps.repo.approve(
      submissionId,
      actor.id,
      request.scores,
      this.deps.clock.now(),
    );

    if (approved && this.deps.events) {
      await this.deps.events.emit('ProjectApproved', {
        userId: row.userId,
        briefId: row.briefId,
        topicId: row.topicId,
      });
    }
  }

  async addReviewerMessage(actor: Actor, submissionId: string, body: string): Promise<void> {
    await this.mustGetRow(submissionId);
    await this.deps.repo.addMessage(submissionId, actor.id, body);
  }

  private async mustGetRow(submissionId: string) {
    const row = await this.deps.repo.getSubmissionRowById(submissionId);
    if (!row) throw new NotFoundError('Submission not found');
    return row;
  }
}
