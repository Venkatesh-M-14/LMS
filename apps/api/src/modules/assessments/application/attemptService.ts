import {
  answerSchemaByType,
  ErrorCodes,
  toStudentPayload,
  type AssessmentSummary,
  type AttemptInProgress,
  type AttemptResult,
  type AttemptView,
  type ExecutionRunView,
  type ItemResult,
  type TestResultView,
} from '@academy/shared';
import { AppError, ForbiddenError, NotFoundError } from '../../../core/errors/appError';
import type { Role } from '@academy/shared';
import type { Clock } from '../../auth/application/ports';
import type { EventBus } from '../../../core/events/eventBus';
import { evaluateStartPolicy } from '../domain/attemptPolicy';
import { gradeItem, roundScore, toScorePct } from '../domain/grading';
import { parseSnapshot, toStudentItems, toTypedItem, type SnapshotItem } from '../domain/snapshot';
import type {
  AssessmentRecord,
  AssessmentRepository,
  AttemptRecord,
  AttemptRepository,
  GradeWrite,
  JudgeQueuePort,
} from './ports';

export interface AttemptServiceDeps {
  assessments: AssessmentRepository;
  attempts: AttemptRepository;
  clock: Clock;
  /** Publishes AttemptGraded — progress (and later gamification) subscribe. */
  events?: EventBus;
  /** Gating port from the progress module: may a student start this quiz? */
  accessGate?: {
    assertLessonAccessible(actor: { id: string; role: Role }, lessonId: string): Promise<void>;
  };
  /** BullMQ adapter; absent in unit tests that never submit coding items. */
  judgeQueue?: JudgeQueuePort;
  /** Adaptive-learning retake gate: open revision assignments block retries. */
  retakeGate?: {
    assertRetakeAllowed(userId: string, assessmentId: string): Promise<void>;
  };
  /** Injectable for deterministic shuffle tests. */
  random?: () => number;
}

export class AttemptService {
  constructor(private readonly deps: AttemptServiceDeps) {}

  /** Quiz card data for a lesson: settings + the caller's attempt history. */
  async getSummaryForLesson(lessonId: string, userId: string): Promise<AssessmentSummary | null> {
    const assessment = await this.deps.assessments.findByLessonId(lessonId);
    if (!assessment) return null;

    const items = await this.deps.assessments.listItems(assessment.id);
    if (items.length === 0) return null; // not takeable yet — hide from students

    const facts = await this.deps.attempts.listFacts(userId, assessment.id);
    const decision = evaluateStartPolicy(assessment, facts, this.deps.clock.now());

    const finished = facts.filter((a) => a.status !== 'IN_PROGRESS');
    const best = finished.reduce<number | null>(
      (acc, a) =>
        a.scorePct === null ? acc : acc === null ? a.scorePct : Math.max(acc, a.scorePct),
      null,
    );
    const last = finished
      .filter((a) => a.submittedAt !== null)
      .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime())[0];

    return {
      id: assessment.id,
      title: assessment.title,
      passingScorePct: assessment.passingScorePct,
      maxAttempts: assessment.maxAttempts,
      cooldownMinutes: assessment.cooldownMinutes,
      itemCount: items.length,
      totalPoints: items.reduce((sum, item) => sum + item.points, 0),
      attemptsUsed: finished.length,
      bestScorePct: best,
      activeAttemptId: decision.resumeAttemptId,
      lastAttempt: last
        ? {
            id: last.id,
            status: last.status,
            scorePct: last.scorePct,
            passed: last.passed,
            submittedAt: last.submittedAt?.toISOString() ?? null,
          }
        : null,
      canStart: decision.canStart,
      blockedReason: decision.blockedReason,
      cooldownEndsAt: decision.cooldownEndsAt?.toISOString() ?? null,
    };
  }

  /** Starts (or resumes) an attempt; the snapshot freezes items at this moment. */
  async start(
    assessmentId: string,
    userId: string,
    role: Role = 'STUDENT',
  ): Promise<AttemptInProgress> {
    const assessment = await this.deps.assessments.findById(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment not found');

    // Gating: a locked lesson's quiz cannot be started either.
    if (assessment.lessonId && this.deps.accessGate) {
      await this.deps.accessGate.assertLessonAccessible({ id: userId, role }, assessment.lessonId);
    }

    const facts = await this.deps.attempts.listFacts(userId, assessmentId);
    const decision = evaluateStartPolicy(assessment, facts, this.deps.clock.now());

    if (decision.resumeAttemptId) {
      const existing = await this.deps.attempts.findById(decision.resumeAttemptId);
      if (existing) return this.toInProgress(existing, assessment);
    }
    // Adaptive gate: a retake is blocked while revision assignments are open.
    if (facts.length > 0 && this.deps.retakeGate) {
      await this.deps.retakeGate.assertRetakeAllowed(userId, assessmentId);
    }
    if (!decision.canStart) {
      if (decision.blockedReason === 'MAX_ATTEMPTS') {
        throw new AppError(
          ErrorCodes.ATTEMPT_LIMIT_REACHED,
          409,
          'No attempts remaining for this quiz',
        );
      }
      throw new AppError(
        ErrorCodes.COOLDOWN_ACTIVE,
        429,
        `Next attempt available at ${decision.cooldownEndsAt?.toISOString()}`,
      );
    }

    const items = await this.deps.assessments.listItems(assessmentId);
    if (items.length === 0) {
      throw new AppError(ErrorCodes.NO_ITEMS_TO_ATTEMPT, 409, 'This quiz has no questions yet');
    }

    const ordered = assessment.shuffleItems ? this.shuffle(items) : items;
    const snapshot: SnapshotItem[] = [];
    for (const [index, item] of ordered.entries()) {
      let payload = item.payload;
      if (item.type === 'CODING' || item.type === 'DEBUGGING') {
        // Freeze the full challenge (instructions, starter files, ALL tests)
        // into the snapshot: the judge grades from here, so challenge edits
        // never change how this attempt is scored.
        const challengeId = (payload as { challengeId?: string }).challengeId ?? '';
        const frozen = await this.deps.assessments.getChallengeFreeze(challengeId);
        if (!frozen) {
          throw new AppError(
            ErrorCodes.NO_ITEMS_TO_ATTEMPT,
            409,
            'A coding challenge in this quiz is missing',
          );
        }
        payload = frozen;
      }
      snapshot.push({
        itemId: item.id,
        order: index + 1,
        type: item.type,
        points: item.points,
        payload,
      });
    }

    const lessonVersionId = assessment.lessonId
      ? await this.deps.assessments.getLessonPublishedVersionId(assessment.lessonId)
      : null;

    const attempt = await this.deps.attempts.create({
      userId,
      assessmentId,
      attemptNumber: facts.length + 1,
      itemsSnapshot: snapshot,
      lessonVersionId,
    });
    return this.toInProgress(attempt, assessment);
  }

  async getView(attemptId: string, userId: string): Promise<AttemptView> {
    const { attempt, assessment } = await this.mustGetOwned(attemptId, userId);
    if (attempt.status === 'IN_PROGRESS') {
      return this.toInProgress(attempt, assessment);
    }
    return this.toResult(attempt, assessment);
  }

  async saveAnswers(
    attemptId: string,
    userId: string,
    answers: Record<string, unknown>,
  ): Promise<void> {
    const { attempt } = await this.mustGetOwned(attemptId, userId);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError(
        ErrorCodes.ATTEMPT_NOT_IN_PROGRESS,
        409,
        'This attempt was already submitted',
      );
    }
    const writes = this.validateAnswers(parseSnapshot(attempt.itemsSnapshot), answers);
    if (writes.length > 0) {
      await this.deps.attempts.upsertAnswers(attemptId, writes);
    }
  }

  /** Grades the attempt from its snapshot. Reflections park it in GRADING. */
  async submit(
    attemptId: string,
    userId: string,
    lastAnswers: Record<string, unknown> = {},
  ): Promise<AttemptResult> {
    const { attempt, assessment } = await this.mustGetOwned(attemptId, userId);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError(
        ErrorCodes.ATTEMPT_NOT_IN_PROGRESS,
        409,
        'This attempt was already submitted',
      );
    }

    const snapshot = parseSnapshot(attempt.itemsSnapshot);

    // Flush any answers the client sent along with submit (belt and braces
    // against a lost autosave), then merge with previously saved ones.
    const flush = this.validateAnswers(snapshot, lastAnswers);
    const answerByItem = new Map<string, unknown>(
      attempt.submissions.map((s) => [s.itemId, s.answer]),
    );
    for (const write of flush) answerByItem.set(write.itemId, write.answer);

    const now = this.deps.clock.now();
    let rawScore = 0;
    let needsManual = false;
    const judgeItemIds: string[] = [];
    const grades: GradeWrite[] = snapshot.map((item) => {
      const answer = answerByItem.get(item.itemId) ?? null;
      const grade = gradeItem(item, answer);
      if (grade.needsManual) needsManual = true;
      if (grade.needsJudge) judgeItemIds.push(item.itemId);
      if (!grade.needsManual && !grade.needsJudge) rawScore += grade.autoScore ?? 0;
      return { itemId: item.itemId, answer, autoScore: grade.autoScore };
    });

    const pending = needsManual || judgeItemIds.length > 0;
    const maxScore = snapshot.reduce((sum, item) => sum + item.points, 0);
    rawScore = roundScore(rawScore);
    const scorePct = pending ? null : toScorePct(rawScore, maxScore);

    const passed = pending ? null : scorePct! >= assessment.passingScorePct;
    await this.deps.attempts.applyGrading(attemptId, grades, {
      status: pending ? 'GRADING' : 'GRADED',
      rawScore: pending ? null : rawScore,
      maxScore,
      scorePct,
      passed,
      submittedAt: now,
      gradedAt: pending ? null : now,
    });

    // Intent rows first, commit, THEN enqueue — a crashed enqueue leaves a
    // recoverable QUEUED row, never a ghost job.
    if (judgeItemIds.length > 0) {
      const withSubmissions = await this.deps.attempts.findById(attemptId);
      for (const itemId of judgeItemIds) {
        const submission = withSubmissions?.submissions.find((s) => s.itemId === itemId);
        const answer = answerByItem.get(itemId) as { files?: Record<string, string> } | null;
        if (!submission || !answer?.files) continue;
        const run = await this.deps.attempts.createExecutionRun(submission.id, answer.files);
        await this.deps.judgeQueue?.enqueue(run.id);
      }
    }

    // While pending, the AttemptGraded event fires from the finalizer instead.
    if (!pending && this.deps.events) {
      await this.deps.events.emit('AttemptGraded', {
        userId,
        attemptId,
        assessmentId: assessment.id,
        lessonId: assessment.lessonId,
        passed: passed!,
        scorePct: scorePct!,
      });
    }

    const graded = await this.deps.attempts.findById(attemptId);
    return this.toResult(graded!, assessment);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async mustGetOwned(attemptId: string, userId: string) {
    const attempt = await this.deps.attempts.findById(attemptId);
    if (!attempt) throw new NotFoundError('Attempt not found');
    if (attempt.userId !== userId) throw new ForbiddenError();
    const assessment = await this.deps.assessments.findById(attempt.assessmentId);
    if (!assessment) throw new NotFoundError('Assessment not found');
    return { attempt, assessment };
  }

  private validateAnswers(
    snapshot: SnapshotItem[],
    answers: Record<string, unknown>,
  ): Array<{ itemId: string; answer: unknown }> {
    const byId = new Map(snapshot.map((item) => [item.itemId, item]));
    const writes: Array<{ itemId: string; answer: unknown }> = [];
    const issues: Array<{ path: string; message: string }> = [];

    for (const [itemId, answer] of Object.entries(answers)) {
      const item = byId.get(itemId);
      if (!item) {
        issues.push({ path: itemId, message: 'Unknown item for this attempt' });
        continue;
      }
      const parsed = answerSchemaByType[item.type].safeParse(answer);
      if (!parsed.success) {
        issues.push({ path: itemId, message: 'Answer shape does not match the question type' });
        continue;
      }
      writes.push({ itemId, answer: parsed.data });
    }

    if (issues.length > 0) {
      throw new AppError(ErrorCodes.ANSWER_INVALID, 400, 'One or more answers are invalid', {
        details: issues,
      });
    }
    return writes;
  }

  private toInProgress(attempt: AttemptRecord, assessment: AssessmentRecord): AttemptInProgress {
    return {
      id: attempt.id,
      status: 'IN_PROGRESS',
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      attemptNumber: attempt.attemptNumber,
      passingScorePct: assessment.passingScorePct,
      startedAt: attempt.startedAt.toISOString(),
      items: toStudentItems(parseSnapshot(attempt.itemsSnapshot)),
      answers: Object.fromEntries(attempt.submissions.map((s) => [s.itemId, s.answer])),
    };
  }

  private toResult(attempt: AttemptRecord, assessment: AssessmentRecord): AttemptResult {
    const snapshot = parseSnapshot(attempt.itemsSnapshot).sort((a, b) => a.order - b.order);
    const submissionByItem = new Map(attempt.submissions.map((s) => [s.itemId, s]));
    const pending = attempt.status === 'GRADING';

    const items: ItemResult[] = snapshot.map((item) => {
      const submission = submissionByItem.get(item.itemId);
      const earned = submission ? (submission.manualScore ?? submission.autoScore) : 0;
      const typed = toTypedItem(item);
      const isReflection = item.type === 'REFLECTION';
      const isCoding = item.type === 'CODING' || item.type === 'DEBUGGING';

      const run = submission?.latestRun;
      const runView: ExecutionRunView | null = run
        ? {
            id: run.id,
            status: run.status,
            results: Array.isArray(run.resultsJson) ? (run.resultsJson as TestResultView[]) : [],
            stdout: run.stdout,
            errorMessage: run.errorMessage,
            durationMs: run.durationMs,
          }
        : null;

      return {
        itemId: item.itemId,
        order: item.order,
        type: item.type,
        points: item.points,
        earned,
        correct: isReflection || earned === null ? null : earned >= item.points,
        // Answer keys reveal after grading — EXCEPT hidden test specs, which
        // never leave the server even on graded coding items.
        payload: earned === null || isCoding ? toStudentPayload(typed) : typed.payload,
        answer: submission?.answer ?? null,
        graderFeedback: submission?.graderFeedback ?? '',
        run: runView,
      };
    });

    return {
      id: attempt.id,
      status: attempt.status as 'GRADING' | 'GRADED',
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      attemptNumber: attempt.attemptNumber,
      passingScorePct: assessment.passingScorePct,
      scorePct: attempt.scorePct,
      rawScore: attempt.rawScore,
      maxScore: attempt.maxScore,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt?.toISOString() ?? '',
      gradedAt: attempt.gradedAt?.toISOString() ?? null,
      pendingManualCount: pending
        ? attempt.submissions.filter((s) => s.autoScore === null && s.manualScore === null).length
        : 0,
      items,
    };
  }

  private shuffle<T>(items: T[]): T[] {
    const random = this.deps.random ?? Math.random;
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }
}
