import { ErrorCodes } from '@academy/shared';
import { AppError } from '../../../../core/errors/appError';
import type { PathStructure, RecordRow, Rule, UnitType } from '../../domain/gating';
import { generateDefaultRules } from '../../domain/gating';
import type { LessonContext, ProgressRepository } from '../ports';
import { ProgressService } from '../progressService';

/**
 * In-memory ProgressRepository whose completeUnit mirrors the SQL guard:
 * the COMPLETED transition happens exactly once per (user, unit).
 */
class FakeProgressRepo implements ProgressRepository {
  private readonly structure: PathStructure = [
    {
      id: 'M1',
      order: 1,
      topics: [
        {
          id: 'T1',
          order: 1,
          lessons: [
            { id: 'L1', order: 1, published: true },
            { id: 'L2', order: 2, published: true },
          ],
        },
        { id: 'T2', order: 2, lessons: [{ id: 'L3', order: 1, published: true }] },
      ],
    },
  ];

  rules: Rule[] = generateDefaultRules(this.structure);
  records = new Map<string, RecordRow & { userId: string }>();
  enrollments: string[] = [];
  quizLessons = new Set<string>(['L1']);

  private key(userId: string, type: UnitType, id: string) {
    return `${userId}|${type}|${id}`;
  }

  async getPathStructure() {
    return { pathId: 'P1', modules: this.structure };
  }
  async getRules() {
    return this.rules;
  }
  async getUserRecords(userId: string) {
    return [...this.records.values()].filter((r) => r.userId === userId);
  }
  async ensureEnrolled(userId: string) {
    if (!this.enrollments.includes(userId)) this.enrollments.push(userId);
  }
  async findLessonContext(lessonId: string): Promise<LessonContext | null> {
    for (const module of this.structure) {
      for (const topic of module.topics) {
        if (topic.lessons.some((l) => l.id === lessonId)) {
          return {
            lessonId,
            topicId: topic.id,
            moduleId: module.id,
            published: true,
            hasQuiz: this.quizLessons.has(lessonId),
          };
        }
      }
    }
    return null;
  }
  async markInProgress(userId: string, unitType: UnitType, unitId: string) {
    const k = this.key(userId, unitType, unitId);
    if (!this.records.has(k)) {
      this.records.set(k, { userId, unitType, unitId, status: 'IN_PROGRESS', bestScorePct: null });
    }
  }
  async completeUnit(userId: string, unitType: UnitType, unitId: string, scorePct: number | null) {
    const k = this.key(userId, unitType, unitId);
    const existing = this.records.get(k);
    if (existing?.status === 'COMPLETED') {
      if (scorePct !== null && (existing.bestScorePct ?? -1) < scorePct) {
        existing.bestScorePct = scorePct;
      }
      return false; // guard: transition already happened
    }
    this.records.set(k, { userId, unitType, unitId, status: 'COMPLETED', bestScorePct: scorePct });
    return true;
  }
}

const student = { id: 'u1', role: 'STUDENT' as const };
const instructor = { id: 'i1', role: 'INSTRUCTOR' as const };

function makeWorld() {
  const repo = new FakeProgressRepo();
  return { repo, service: new ProgressService(repo) };
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

describe('ProgressService — access control', () => {
  it('blocks students from locked lessons with GATING_LOCKED', async () => {
    const { service } = makeWorld();
    await expectCode(service.assertLessonAccessible(student, 'L2'), ErrorCodes.GATING_LOCKED);
  });

  it('allows the first lesson', async () => {
    const { service } = makeWorld();
    await expect(service.assertLessonAccessible(student, 'L1')).resolves.toBeUndefined();
  });

  it('instructors and admins bypass gating entirely', async () => {
    const { service } = makeWorld();
    await expect(service.assertLessonAccessible(instructor, 'L3')).resolves.toBeUndefined();
    await expect(
      service.assertLessonAccessible({ id: 'a1', role: 'ADMIN' }, 'L3'),
    ).resolves.toBeUndefined();
  });

  it('getMap auto-enrolls students but not instructors', async () => {
    const { repo, service } = makeWorld();
    await service.getMap(student);
    await service.getMap(instructor);
    expect(repo.enrollments).toEqual(['u1']);
  });
});

describe('ProgressService — completion cascade', () => {
  it('passing the last lesson of a topic completes lesson, topic, and module in one cascade', async () => {
    const { repo, service } = makeWorld();
    await service.onAttemptGraded({ userId: 'u1', lessonId: 'L1', passed: true, scorePct: 80 });

    let map = await service.getMap(student);
    expect(map.lessons['L1']?.status).toBe('COMPLETED');
    expect(map.lessons['L2']?.status).toBe('AVAILABLE');

    // L2 has no quiz → manual completion path.
    repo.quizLessons.delete('L2');
    const result = await service.markLessonComplete(student, 'L2');
    expect(result).toEqual({ lessonCompleted: true, topicCompleted: true, moduleCompleted: false });

    map = await service.getMap(student);
    expect(map.topics['T1']?.status).toBe('COMPLETED');
    expect(map.lessons['L3']?.status).toBe('AVAILABLE'); // T2 unlocked

    // Completing L3 completes T2 — and with it the whole module.
    await service.onAttemptGraded({ userId: 'u1', lessonId: 'L3', passed: true, scorePct: 90 });
    map = await service.getMap(student);
    expect(map.modules['M1']?.status).toBe('COMPLETED');
    expect(map.nextLessonId).toBeNull();
    expect(map.completedLessons).toBe(3);
  });

  it('failed attempts complete nothing', async () => {
    const { service } = makeWorld();
    await service.onAttemptGraded({ userId: 'u1', lessonId: 'L1', passed: false, scorePct: 30 });
    const map = await service.getMap(student);
    expect(map.lessons['L1']?.status).toBe('AVAILABLE');
  });

  it('concurrent passes record the lesson completion exactly once', async () => {
    const { repo, service } = makeWorld();
    const event = { userId: 'u1', lessonId: 'L1', passed: true, scorePct: 70 };
    await Promise.all([
      service.onAttemptGraded(event),
      service.onAttemptGraded({ ...event, scorePct: 90 }),
    ]);

    const records = [...repo.records.values()].filter(
      (r) => r.unitType === 'LESSON' && r.unitId === 'L1',
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe('COMPLETED');
    expect(records[0]?.bestScorePct).toBe(90); // best score survives the race
  });

  it('retakes update the best score without a second transition', async () => {
    const { repo, service } = makeWorld();
    await service.onAttemptGraded({ userId: 'u1', lessonId: 'L1', passed: true, scorePct: 70 });
    await service.onAttemptGraded({ userId: 'u1', lessonId: 'L1', passed: true, scorePct: 95 });
    const record = [...repo.records.values()].find((r) => r.unitId === 'L1');
    expect(record?.bestScorePct).toBe(95);
  });

  it('mark-complete refuses lessons that have a quiz', async () => {
    const { service } = makeWorld();
    await expectCode(service.markLessonComplete(student, 'L1'), ErrorCodes.LESSON_HAS_QUIZ);
  });

  it('mark-complete refuses locked lessons', async () => {
    const { repo, service } = makeWorld();
    repo.quizLessons.clear();
    await expectCode(service.markLessonComplete(student, 'L2'), ErrorCodes.GATING_LOCKED);
  });
});
