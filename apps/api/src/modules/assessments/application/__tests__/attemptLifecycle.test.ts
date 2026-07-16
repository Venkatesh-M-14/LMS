import { ErrorCodes } from '@academy/shared';
import { AppError } from '../../../../core/errors/appError';
import { MutableClock } from '../../../auth/application/__tests__/fakes';
import { AttemptService } from '../attemptService';
import { AttemptFinalizer } from '../attemptFinalizer';
import { GradingService } from '../gradingService';
import type {
  AssessmentRecord,
  AssessmentRepository,
  AttemptRecord,
  AttemptRepository,
  FinalizeWrite,
  GradeWrite,
  GradingRepository,
  ItemRecord,
  SubmissionRecord,
} from '../ports';

/** Shared in-memory state; each port gets its own class over it. */
class WorldState {
  assessment: AssessmentRecord = {
    id: 'as-1',
    lessonId: 'lesson-1',
    title: 'Test Quiz',
    passingScorePct: 70,
    maxAttempts: null,
    cooldownMinutes: 0,
    shuffleItems: false,
  };

  items: ItemRecord[] = [
    {
      id: 'q1',
      order: 1,
      type: 'MCQ',
      points: 2,
      payload: {
        prompt: 'Pick',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionId: 'a',
      },
    },
    {
      id: 'q2',
      order: 2,
      type: 'REFLECTION',
      points: 4,
      payload: { prompt: 'Explain.' },
    },
  ];

  attempts: AttemptRecord[] = [];
  nextId = 1;

  mustGet(attemptId: string): AttemptRecord {
    const attempt = this.attempts.find((a) => a.id === attemptId);
    if (!attempt) throw new Error(`no attempt ${attemptId}`);
    return attempt;
  }
}

class FakeAssessmentRepo implements AssessmentRepository {
  constructor(private readonly state: WorldState) {}
  async findByLessonId() {
    return this.state.assessment;
  }
  async findById(id: string) {
    return id === this.state.assessment.id ? this.state.assessment : null;
  }
  async listItems() {
    return this.state.items;
  }
  async getAuthoringView() {
    return null;
  }
  async upsertForLesson() {
    return this.state.assessment;
  }
  async replaceItems() {
    /* not used */
  }
  async appendItem() {
    /* not used — authoring is covered by the suggestion + CMS tests */
    return { id: 'item-appended' };
  }
  async getLessonPublishedVersionId() {
    return 'lv-1';
  }
  async getChallengeFreeze() {
    return null;
  }
  async listChallenges() {
    return [];
  }
}

class FakeAttemptRepo implements AttemptRepository {
  constructor(private readonly state: WorldState) {}
  async listFacts(userId: string, assessmentId: string) {
    return this.state.attempts
      .filter((a) => a.userId === userId && a.assessmentId === assessmentId)
      .map((a) => ({
        id: a.id,
        status: a.status,
        scorePct: a.scorePct,
        passed: a.passed,
        submittedAt: a.submittedAt,
      }));
  }
  async findById(attemptId: string) {
    const found = this.state.attempts.find((a) => a.id === attemptId);
    return found ? structuredClone(found) : null;
  }
  async create(input: {
    userId: string;
    assessmentId: string;
    attemptNumber: number;
    itemsSnapshot: unknown;
    lessonVersionId: string | null;
  }) {
    const attempt: AttemptRecord = {
      id: `at-${this.state.nextId++}`,
      userId: input.userId,
      assessmentId: input.assessmentId,
      attemptNumber: input.attemptNumber,
      status: 'IN_PROGRESS',
      passed: null,
      scorePct: null,
      rawScore: null,
      maxScore: null,
      itemsSnapshot: structuredClone(input.itemsSnapshot),
      startedAt: new Date('2026-07-16T09:00:00Z'),
      submittedAt: null,
      gradedAt: null,
      submissions: [],
    };
    this.state.attempts.push(attempt);
    return structuredClone(attempt);
  }
  async upsertAnswers(attemptId: string, answers: Array<{ itemId: string; answer: unknown }>) {
    const attempt = this.state.mustGet(attemptId);
    for (const { itemId, answer } of answers) {
      const existing = attempt.submissions.find((s) => s.itemId === itemId);
      if (existing) existing.answer = answer;
      else {
        attempt.submissions.push({
          id: `sub-${this.state.nextId++}`,
          itemId,
          answer,
          autoScore: null,
          manualScore: null,
          graderFeedback: '',
        });
      }
    }
  }
  runs: Array<{ id: string; submissionId: string; files: Record<string, string>; status: string }> =
    [];

  async createExecutionRun(itemSubmissionId: string, files: Record<string, string>) {
    const run = {
      id: `run-${this.state.nextId++}`,
      submissionId: itemSubmissionId,
      files,
      status: 'QUEUED',
    };
    this.runs.push(run);
    return { id: run.id };
  }
  async claimRun(runId: string) {
    const run = this.runs.find((r) => r.id === runId && r.status === 'QUEUED');
    if (!run) return null;
    run.status = 'RUNNING';
    for (const attempt of this.state.attempts) {
      const submission = attempt.submissions.find((s) => s.id === run.submissionId);
      if (submission) {
        return {
          runId: run.id,
          submissionId: submission.id,
          attemptId: attempt.id,
          itemId: submission.itemId,
          files: run.files,
        };
      }
    }
    return null;
  }
  async completeRun(
    runId: string,
    submissionId: string,
    data: { status: string; autoScore: number },
  ) {
    const run = this.runs.find((r) => r.id === runId);
    if (run) run.status = data.status;
    for (const attempt of this.state.attempts) {
      const submission = attempt.submissions.find((s) => s.id === submissionId);
      if (submission) submission.autoScore = data.autoScore;
    }
  }

  async applyGrading(attemptId: string, grades: GradeWrite[], finalize: FinalizeWrite) {
    const attempt = this.state.mustGet(attemptId);
    for (const grade of grades) {
      const existing = attempt.submissions.find((s) => s.itemId === grade.itemId);
      if (existing) {
        existing.answer = grade.answer;
        existing.autoScore = grade.autoScore;
      } else {
        attempt.submissions.push({
          id: `sub-${this.state.nextId++}`,
          itemId: grade.itemId,
          answer: grade.answer,
          autoScore: grade.autoScore,
          manualScore: null,
          graderFeedback: '',
        });
      }
    }
    Object.assign(attempt, finalize);
  }
}

class FakeGradingRepo implements GradingRepository {
  constructor(private readonly state: WorldState) {}
  async listQueue() {
    return [];
  }
  async getDetail(attemptId: string) {
    const found = this.state.attempts.find((a) => a.id === attemptId);
    if (!found) return null;
    return {
      attempt: structuredClone(found),
      studentName: 'Student',
      assessmentTitle: this.state.assessment.title,
      lessonTitle: null,
    };
  }
  async findSubmission(
    submissionId: string,
  ): Promise<(SubmissionRecord & { attemptId: string }) | null> {
    for (const attempt of this.state.attempts) {
      const submission = attempt.submissions.find((s) => s.id === submissionId);
      if (submission) return { ...structuredClone(submission), attemptId: attempt.id };
    }
    return null;
  }
  async setManualScore(submissionId: string, _graderId: string, score: number, feedback: string) {
    for (const attempt of this.state.attempts) {
      const submission = attempt.submissions.find((s) => s.id === submissionId);
      if (submission) {
        submission.manualScore = score;
        submission.graderFeedback = feedback;
      }
    }
  }
  async finalizeAttempt(attemptId: string, finalize: Omit<FinalizeWrite, 'submittedAt'>) {
    Object.assign(this.state.mustGet(attemptId), finalize);
  }
}

function makeWorld() {
  const world = new WorldState();
  const clock = new MutableClock(new Date('2026-07-16T10:00:00Z'));
  const assessments = new FakeAssessmentRepo(world);
  const attemptRepo = new FakeAttemptRepo(world);
  const gradingRepo = new FakeGradingRepo(world);
  const attempts = new AttemptService({ assessments, attempts: attemptRepo, clock });
  const finalizer = new AttemptFinalizer({
    attempts: attemptRepo,
    assessments,
    grading: gradingRepo,
    clock,
  });
  const grading = new GradingService({
    grading: gradingRepo,
    attempts: attemptRepo,
    finalizer,
    clock,
  });
  return { world, clock, attempts, grading };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

describe('AttemptService lifecycle', () => {
  it('start snapshots items and strips answer keys from the student view', async () => {
    const { attempts } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');

    expect(attempt.items).toHaveLength(2);
    const mcq = attempt.items.find((i) => i.type === 'MCQ')!;
    expect(JSON.stringify(mcq.payload)).not.toContain('correctOptionId');
  });

  it('editing items after start does not change an in-flight attempt (snapshot immutability)', async () => {
    const { world, attempts } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');

    // Instructor rewrites the quiz mid-attempt.
    world.items = [
      {
        id: 'q-new',
        order: 1,
        type: 'MCQ',
        points: 10,
        payload: {
          prompt: 'Different question',
          options: [
            { id: 'x', text: 'X' },
            { id: 'y', text: 'Y' },
          ],
          correctOptionId: 'x',
        },
      },
    ];

    await attempts.saveAnswers(attempt.id, 'user-1', { q1: { selectedOptionId: 'a' } });
    const result = await attempts.submit(attempt.id, 'user-1');

    // Graded against the ORIGINAL two items, not the rewrite.
    expect(result.maxScore).toBe(6);
    expect(result.items.map((i) => i.itemId).sort()).toEqual(['q1', 'q2']);
  });

  it('resumes the open attempt instead of creating a second one', async () => {
    const { world, attempts } = makeWorld();
    const first = await attempts.start('as-1', 'user-1');
    const second = await attempts.start('as-1', 'user-1');
    expect(second.id).toBe(first.id);
    expect(world.attempts).toHaveLength(1);
  });

  it('rejects answers for items outside the snapshot', async () => {
    const { attempts } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');
    await expectCode(
      attempts.saveAnswers(attempt.id, 'user-1', { ghost: { selectedOptionId: 'a' } }),
      ErrorCodes.ANSWER_INVALID,
    );
  });

  it('a fully auto-gradable submission grades immediately and applies the threshold', async () => {
    const { world, attempts } = makeWorld();
    world.items = world.items.filter((i) => i.type === 'MCQ'); // drop the reflection
    const attempt = await attempts.start('as-1', 'user-1');

    const result = await attempts.submit(attempt.id, 'user-1', { q1: { selectedOptionId: 'a' } });
    expect(result.status).toBe('GRADED');
    expect(result.scorePct).toBe(100);
    expect(result.passed).toBe(true);

    // Second attempt, wrong answer → fail.
    const retake = await attempts.start('as-1', 'user-1');
    const failed = await attempts.submit(retake.id, 'user-1', { q1: { selectedOptionId: 'b' } });
    expect(failed.passed).toBe(false);
    expect(failed.scorePct).toBe(0);
  });

  it('enforces maxAttempts', async () => {
    const { world, attempts } = makeWorld();
    world.assessment.maxAttempts = 1;
    world.items = world.items.filter((i) => i.type === 'MCQ');

    const attempt = await attempts.start('as-1', 'user-1');
    await attempts.submit(attempt.id, 'user-1', { q1: { selectedOptionId: 'b' } });
    await expectCode(attempts.start('as-1', 'user-1'), ErrorCodes.ATTEMPT_LIMIT_REACHED);
  });

  it('enforces the cooldown between attempts', async () => {
    const { world, clock, attempts } = makeWorld();
    world.assessment.cooldownMinutes = 30;
    world.items = world.items.filter((i) => i.type === 'MCQ');

    const attempt = await attempts.start('as-1', 'user-1');
    await attempts.submit(attempt.id, 'user-1', {});
    await expectCode(attempts.start('as-1', 'user-1'), ErrorCodes.COOLDOWN_ACTIVE);

    clock.advanceSec(31 * 60);
    const retake = await attempts.start('as-1', 'user-1');
    expect(retake.status).toBe('IN_PROGRESS');
  });

  it('cannot submit twice', async () => {
    const { world, attempts } = makeWorld();
    world.items = world.items.filter((i) => i.type === 'MCQ');
    const attempt = await attempts.start('as-1', 'user-1');
    await attempts.submit(attempt.id, 'user-1', {});
    await expectCode(attempts.submit(attempt.id, 'user-1', {}), ErrorCodes.ATTEMPT_NOT_IN_PROGRESS);
  });

  it('another user cannot read someone else’s attempt', async () => {
    const { attempts } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');
    await expectCode(attempts.getView(attempt.id, 'user-2'), ErrorCodes.FORBIDDEN);
  });
});

describe('Manual grading flow', () => {
  it('answered reflection parks the attempt in GRADING with auto results hidden keys', async () => {
    const { attempts } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');
    const result = await attempts.submit(attempt.id, 'user-1', {
      q1: { selectedOptionId: 'a' },
      q2: { text: 'Because processes isolate memory…' },
    });

    expect(result.status).toBe('GRADING');
    expect(result.scorePct).toBeNull();
    expect(result.pendingManualCount).toBe(1);
    const reflection = result.items.find((i) => i.type === 'REFLECTION')!;
    expect(reflection.earned).toBeNull();
  });

  it('grading the last reflection finalizes: totals, GRADED, pass/fail', async () => {
    const { world, attempts, grading } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');
    await attempts.submit(attempt.id, 'user-1', {
      q1: { selectedOptionId: 'a' }, // 2/2 auto
      q2: { text: 'Thoughtful answer' },
    });

    const detail = await grading.getDetail(attempt.id);
    expect(detail.reflections).toHaveLength(1);

    await grading.gradeSubmission(detail.reflections[0]!.submissionId, 'grader-1', {
      score: 3,
      feedback: 'Good reasoning.',
    });

    const final = world.attempts[0]!;
    expect(final.status).toBe('GRADED');
    expect(final.rawScore).toBe(5); // 2 auto + 3 manual
    expect(final.maxScore).toBe(6);
    expect(final.scorePct).toBe(83.3);
    expect(final.passed).toBe(true); // ≥ 70
  });

  it('rejects scores above the item points', async () => {
    const { attempts, grading } = makeWorld();
    const attempt = await attempts.start('as-1', 'user-1');
    await attempts.submit(attempt.id, 'user-1', { q2: { text: 'answer' } });
    const detail = await grading.getDetail(attempt.id);

    await expectCode(
      grading.gradeSubmission(detail.reflections[0]!.submissionId, 'grader-1', {
        score: 99,
        feedback: '',
      }),
      ErrorCodes.SCORE_EXCEEDS_POINTS,
    );
  });
});
