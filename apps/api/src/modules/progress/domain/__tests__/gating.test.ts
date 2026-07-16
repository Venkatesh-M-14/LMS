import {
  GatingEvaluator,
  generateDefaultRules,
  type PathStructure,
  type RecordRow,
  type Rule,
} from '../gating';

/**
 * Structure under test:
 *   Module M1: Topic T1 [L1, L2] · Topic T2 [L3] · Topic T3 [] (outline)
 *   Module M2: Topic T4 [L4]
 */
const structure: PathStructure = [
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
      { id: 'T3', order: 3, lessons: [] },
    ],
  },
  {
    id: 'M2',
    order: 2,
    topics: [{ id: 'T4', order: 1, lessons: [{ id: 'L4', order: 1, published: true }] }],
  },
];

const rules: Rule[] = generateDefaultRules(structure);

const completed = (
  type: 'LESSON' | 'TOPIC' | 'MODULE',
  id: string,
  score: number | null = null,
): RecordRow => ({
  unitType: type,
  unitId: id,
  status: 'COMPLETED',
  bestScorePct: score,
});

function evaluate(records: RecordRow[]) {
  return new GatingEvaluator(structure, rules, records);
}

describe('generateDefaultRules', () => {
  it('produces strictly sequential rules for lessons, topics, and modules', () => {
    expect(rules).toContainEqual(
      expect.objectContaining({ unitType: 'LESSON', unitId: 'L2', requiredUnitId: 'L1' }),
    );
    expect(rules).toContainEqual(
      expect.objectContaining({ unitType: 'TOPIC', unitId: 'T2', requiredUnitId: 'T1' }),
    );
    expect(rules).toContainEqual(
      expect.objectContaining({ unitType: 'MODULE', unitId: 'M2', requiredUnitId: 'M1' }),
    );
    // First units have no prerequisites.
    expect(rules.some((r) => r.unitId === 'L1' || r.unitId === 'T1' || r.unitId === 'M1')).toBe(
      false,
    );
  });
});

describe('GatingEvaluator — availability', () => {
  it('a brand-new user sees only the very first lesson available', () => {
    const map = evaluate([]).computeMap();
    expect(map.lessons['L1']?.status).toBe('AVAILABLE');
    expect(map.lessons['L2']?.status).toBe('LOCKED');
    expect(map.lessons['L3']?.status).toBe('LOCKED');
    expect(map.lessons['L4']?.status).toBe('LOCKED');
    expect(map.nextLessonId).toBe('L1');
    expect(map.totalLessons).toBe(4);
    expect(map.completedLessons).toBe(0);
  });

  it('completing L1 unlocks L2 but not T2', () => {
    const map = evaluate([completed('LESSON', 'L1', 80)]).computeMap();
    expect(map.lessons['L1']?.status).toBe('COMPLETED');
    expect(map.lessons['L2']?.status).toBe('AVAILABLE');
    expect(map.lessons['L3']?.status).toBe('LOCKED');
    expect(map.nextLessonId).toBe('L2');
  });

  it('lessons in a later topic unlock only when the previous topic completes', () => {
    const map = evaluate([
      completed('LESSON', 'L1'),
      completed('LESSON', 'L2'),
      completed('TOPIC', 'T1'),
    ]).computeMap();
    expect(map.topics['T2']?.status).toBe('AVAILABLE');
    expect(map.lessons['L3']?.status).toBe('AVAILABLE');
    expect(map.lessons['L4']?.status).toBe('LOCKED'); // module 2 still gated
  });

  it('a lesson whose own rule is met stays locked while its topic is locked (hierarchy)', () => {
    // L3 has no lesson-level prerequisite, but T2 requires T1.
    const map = evaluate([]).computeMap();
    expect(map.lessons['L3']?.status).toBe('LOCKED');
  });

  it('IN_PROGRESS shows only when the unit is accessible', () => {
    const records: RecordRow[] = [
      { unitType: 'LESSON', unitId: 'L1', status: 'IN_PROGRESS', bestScorePct: null },
      // Stale record on a locked lesson must still render LOCKED.
      { unitType: 'LESSON', unitId: 'L4', status: 'IN_PROGRESS', bestScorePct: null },
    ];
    const map = evaluate(records).computeMap();
    expect(map.lessons['L1']?.status).toBe('IN_PROGRESS');
    expect(map.lessons['L4']?.status).toBe('LOCKED');
  });

  it('honours minScorePct on rules', () => {
    const strictRules: Rule[] = [
      {
        unitType: 'LESSON',
        unitId: 'L2',
        requiredUnitType: 'LESSON',
        requiredUnitId: 'L1',
        minScorePct: 80,
      },
    ];
    const low = new GatingEvaluator(structure, strictRules, [completed('LESSON', 'L1', 70)]);
    const high = new GatingEvaluator(structure, strictRules, [completed('LESSON', 'L1', 85)]);
    expect(low.rulesSatisfied('LESSON', 'L2')).toBe(false);
    expect(high.rulesSatisfied('LESSON', 'L2')).toBe(true);
  });
});

describe('GatingEvaluator — completability', () => {
  it('a topic completes when all its published lessons are completed', () => {
    const evaluator = evaluate([completed('LESSON', 'L1'), completed('LESSON', 'L2')]);
    expect(evaluator.topicCompletable(structure[0]!.topics[0]!)).toBe(true);
  });

  it('an empty (outline) topic is never completable', () => {
    const evaluator = evaluate([]);
    expect(evaluator.topicCompletable(structure[0]!.topics[2]!)).toBe(false);
  });

  it('a module completes from its content topics only — outline topics do not block', () => {
    const evaluator = evaluate([completed('TOPIC', 'T1'), completed('TOPIC', 'T2')]);
    expect(evaluator.moduleCompletable(structure[0]!)).toBe(true);
  });

  it('a module with an incomplete content topic is not completable', () => {
    const evaluator = evaluate([completed('TOPIC', 'T1')]);
    expect(evaluator.moduleCompletable(structure[0]!)).toBe(false);
  });
});
