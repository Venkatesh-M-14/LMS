import { ErrorCodes } from '@academy/shared';
import type { RevisionAssignmentView } from '@academy/shared';
import { AppError } from '../../../../core/errors/appError';
import { AdaptiveService } from '../adaptiveService';
import type { AdaptiveRepository, AttemptGradedFacts } from '../ports';

interface Assignment {
  id: string;
  userId: string;
  assessmentId: string;
  skillId: string;
  targetLessonId: string;
  reason: string;
  status: 'ASSIGNED' | 'COMPLETED';
}

/** In-memory repo mirroring the unique (user, assessment, skill) constraint. */
class FakeRepo implements AdaptiveRepository {
  facts = new Map<string, AttemptGradedFacts>();
  assignments: Assignment[] = [];
  lessonForSkill = new Map<string, { lessonId: string; title: string }>();
  lessonTitles = new Map<string, string>([['lesson-1', 'How a Computer Works']]);
  private seq = 0;

  async getAttemptGradedFacts(attemptId: string): Promise<AttemptGradedFacts | null> {
    return this.facts.get(attemptId) ?? null;
  }

  async findLessonForSkill(skillId: string) {
    return this.lessonForSkill.get(skillId) ?? null;
  }

  async createAssignment(input: {
    userId: string;
    assessmentId: string;
    skillId: string;
    targetLessonId: string;
    reason: string;
  }): Promise<void> {
    const exists = this.assignments.some(
      (a) =>
        a.userId === input.userId &&
        a.assessmentId === input.assessmentId &&
        a.skillId === input.skillId,
    );
    if (exists) return; // idempotent: unique (user, assessment, skill)
    this.assignments.push({ id: `ra-${this.seq++}`, status: 'ASSIGNED', ...input });
  }

  async listOpenBlocking(userId: string, assessmentId: string) {
    const rows = this.assignments.filter(
      (a) => a.userId === userId && a.assessmentId === assessmentId && a.status === 'ASSIGNED',
    );
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.targetLessonId, this.lessonTitles.get(r.targetLessonId) ?? r.targetLessonId);
    return [...seen.entries()].map(([targetLessonId, targetLessonTitle]) => ({
      targetLessonId,
      targetLessonTitle,
    }));
  }

  async listAssignments(userId: string): Promise<RevisionAssignmentView[]> {
    return this.assignments
      .filter((a) => a.userId === userId)
      .map((a) => ({
        id: a.id,
        assessmentId: a.assessmentId,
        assessmentTitle: 'Quiz',
        skillName: a.skillId,
        targetLessonId: a.targetLessonId,
        targetLessonTitle: this.lessonTitles.get(a.targetLessonId) ?? a.targetLessonId,
        blocksRetake: true,
        status: a.status,
        reason: a.reason,
        createdAt: '2026-01-01T00:00:00.000Z',
      }));
  }

  async completeAssignmentsForLesson(userId: string, lessonId: string): Promise<void> {
    for (const a of this.assignments) {
      if (a.userId === userId && a.targetLessonId === lessonId && a.status === 'ASSIGNED') {
        a.status = 'COMPLETED';
      }
    }
  }
}

const facts = (partial: Partial<AttemptGradedFacts>): AttemptGradedFacts => ({
  userId: 'u1',
  assessmentId: 'as1',
  lessonId: 'lesson-1',
  passed: false,
  items: [],
  ...partial,
});

describe('AdaptiveService.onAttemptGraded', () => {
  it('assigns a revision per weak skill, targeting the failed lesson', async () => {
    const repo = new FakeRepo();
    repo.facts.set('att1', facts({
      items: [
        { itemId: 'a', skillIds: ['skill-cpu'], earned: 0, points: 2 },
        { itemId: 'b', skillIds: ['skill-mem'], earned: 3, points: 3 },
      ],
    }));
    const service = new AdaptiveService({ repo });

    await service.onAttemptGraded({ userId: 'u1', attemptId: 'att1', passed: false });

    expect(repo.assignments).toHaveLength(1);
    expect(repo.assignments[0]).toMatchObject({
      skillId: 'skill-cpu',
      targetLessonId: 'lesson-1',
      status: 'ASSIGNED',
    });
  });

  it('ignores a passed attempt', async () => {
    const repo = new FakeRepo();
    repo.facts.set('att1', facts({ passed: true, items: [{ itemId: 'a', skillIds: ['s'], earned: 0, points: 1 }] }));
    const service = new AdaptiveService({ repo });

    await service.onAttemptGraded({ userId: 'u1', attemptId: 'att1', passed: true });

    expect(repo.assignments).toHaveLength(0);
  });

  it('falls back to the skill lesson when the attempt has no lesson', async () => {
    const repo = new FakeRepo();
    repo.lessonForSkill.set('skill-x', { lessonId: 'lesson-x', title: 'Skill X' });
    repo.facts.set('att1', facts({
      lessonId: null,
      items: [{ itemId: 'a', skillIds: ['skill-x'], earned: 0, points: 1 }],
    }));
    const service = new AdaptiveService({ repo });

    await service.onAttemptGraded({ userId: 'u1', attemptId: 'att1', passed: false });

    expect(repo.assignments[0]?.targetLessonId).toBe('lesson-x');
  });

  it('is idempotent — re-grading the same attempt adds no duplicate', async () => {
    const repo = new FakeRepo();
    repo.facts.set('att1', facts({ items: [{ itemId: 'a', skillIds: ['s'], earned: 0, points: 1 }] }));
    const service = new AdaptiveService({ repo });

    await service.onAttemptGraded({ userId: 'u1', attemptId: 'att1', passed: false });
    await service.onAttemptGraded({ userId: 'u1', attemptId: 'att1', passed: false });

    expect(repo.assignments).toHaveLength(1);
  });
});

describe('AdaptiveService retake gating', () => {
  it('blocks a retake while a revision is open', async () => {
    const repo = new FakeRepo();
    repo.assignments.push({
      id: 'ra-0',
      userId: 'u1',
      assessmentId: 'as1',
      skillId: 's',
      targetLessonId: 'lesson-1',
      reason: 'x',
      status: 'ASSIGNED',
    });
    const service = new AdaptiveService({ repo });

    await expect(service.assertRetakeAllowed('u1', 'as1')).rejects.toMatchObject({
      code: ErrorCodes.REVISION_REQUIRED,
    });
    await expect(service.assertRetakeAllowed('u1', 'as1')).rejects.toBeInstanceOf(AppError);
  });

  it('allows a retake once the lesson is reviewed', async () => {
    const repo = new FakeRepo();
    repo.assignments.push({
      id: 'ra-0',
      userId: 'u1',
      assessmentId: 'as1',
      skillId: 's',
      targetLessonId: 'lesson-1',
      reason: 'x',
      status: 'ASSIGNED',
    });
    const service = new AdaptiveService({ repo });

    await service.onLessonOpened('u1', 'lesson-1');

    await expect(service.assertRetakeAllowed('u1', 'as1')).resolves.toBeUndefined();
    expect((await repo.listAssignments('u1'))[0]?.status).toBe('COMPLETED');
  });

  it('allows a retake when there are no assignments', async () => {
    const service = new AdaptiveService({ repo: new FakeRepo() });
    await expect(service.assertRetakeAllowed('u1', 'as1')).resolves.toBeUndefined();
  });
});
