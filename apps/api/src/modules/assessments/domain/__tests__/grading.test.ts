import { gradeItem, normalizeOutput, toScorePct } from '../grading';
import type { SnapshotItem } from '../snapshot';

const mcq: SnapshotItem = {
  itemId: 'i1',
  order: 1,
  type: 'MCQ',
  points: 2,
  payload: {
    prompt: 'Pick one',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionId: 'b',
  },
};

const multi: SnapshotItem = {
  itemId: 'i2',
  order: 2,
  type: 'MULTI_SELECT',
  points: 4,
  payload: {
    prompt: 'Pick some',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
      { id: 'd', text: 'D' },
    ],
    correctOptionIds: ['a', 'c'],
  },
};

const output: SnapshotItem = {
  itemId: 'i3',
  order: 3,
  type: 'OUTPUT_PREDICTION',
  points: 3,
  payload: {
    prompt: 'What prints?',
    language: 'javascript',
    code: 'console.log(1+1)',
    expectedOutput: '2',
    matchMode: 'trimmed',
  },
};

const reflection: SnapshotItem = {
  itemId: 'i4',
  order: 4,
  type: 'REFLECTION',
  points: 5,
  payload: { prompt: 'Explain.' },
};

describe('gradeItem — MCQ', () => {
  it('awards full points for the correct option', () => {
    expect(gradeItem(mcq, { selectedOptionId: 'b' })).toEqual({
      autoScore: 2,
      correct: true,
      needsManual: false,
      needsJudge: false,
    });
  });

  it('awards zero for a wrong option', () => {
    expect(gradeItem(mcq, { selectedOptionId: 'a' })).toEqual({
      autoScore: 0,
      correct: false,
      needsManual: false,
      needsJudge: false,
    });
  });

  it('awards zero for a missing or malformed answer', () => {
    expect(gradeItem(mcq, null).autoScore).toBe(0);
    expect(gradeItem(mcq, { nonsense: true }).autoScore).toBe(0);
  });
});

describe('gradeItem — MULTI_SELECT partial credit', () => {
  const answer = (ids: string[]) => gradeItem(multi, { selectedOptionIds: ids });

  it('full points for the exact correct set', () => {
    expect(answer(['a', 'c'])).toEqual({
      autoScore: 4,
      correct: true,
      needsManual: false,
      needsJudge: false,
    });
  });

  it('half points for one of two correct picks', () => {
    expect(answer(['a'])).toEqual({
      autoScore: 2,
      correct: false,
      needsManual: false,
      needsJudge: false,
    });
  });

  it('a wrong pick cancels a right one', () => {
    expect(answer(['a', 'b']).autoScore).toBe(0);
  });

  it('selecting everything is not free points', () => {
    expect(answer(['a', 'b', 'c', 'd']).autoScore).toBe(0);
  });

  it('never goes negative', () => {
    expect(answer(['b', 'd']).autoScore).toBe(0);
  });

  it('empty selection scores zero', () => {
    expect(answer([]).autoScore).toBe(0);
  });
});

describe('gradeItem — OUTPUT_PREDICTION match modes', () => {
  it('trimmed mode ignores surrounding whitespace', () => {
    expect(gradeItem(output, { predictedOutput: '  2\n' }).autoScore).toBe(3);
  });

  it('trimmed mode is still case/inner-space sensitive', () => {
    expect(gradeItem(output, { predictedOutput: '2 0' }).autoScore).toBe(0);
  });

  it('normalized mode folds case and whitespace', () => {
    const item: SnapshotItem = {
      ...output,
      payload: {
        ...(output.payload as object),
        expectedOutput: 'Hello  World',
        matchMode: 'normalized',
      },
    };
    expect(gradeItem(item, { predictedOutput: '  hello world ' }).autoScore).toBe(3);
  });

  it('exact mode is verbatim', () => {
    const item: SnapshotItem = {
      ...output,
      payload: { ...(output.payload as object), matchMode: 'exact' },
    };
    expect(gradeItem(item, { predictedOutput: '2 ' }).autoScore).toBe(0);
    expect(gradeItem(item, { predictedOutput: '2' }).autoScore).toBe(3);
  });
});

describe('gradeItem — REFLECTION', () => {
  it('parks answered reflections for manual grading', () => {
    expect(gradeItem(reflection, { text: 'My thoughts here.' })).toEqual({
      autoScore: null,
      correct: null,
      needsManual: true,
      needsJudge: false,
    });
  });

  it('auto-zeroes empty or missing reflections (no manual work created)', () => {
    expect(gradeItem(reflection, { text: '   ' })).toEqual({
      autoScore: 0,
      correct: null,
      needsManual: false,
      needsJudge: false,
    });
    expect(gradeItem(reflection, null).needsManual).toBe(false);
  });
});

describe('score helpers', () => {
  it('normalizeOutput modes', () => {
    expect(normalizeOutput(' A  B ', 'exact')).toBe(' A  B ');
    expect(normalizeOutput(' A  B ', 'trimmed')).toBe('A  B');
    expect(normalizeOutput(' A  B ', 'normalized')).toBe('a b');
  });

  it('toScorePct rounds to one decimal and handles zero max', () => {
    expect(toScorePct(2, 3)).toBe(66.7);
    expect(toScorePct(0, 0)).toBe(0);
    expect(toScorePct(12, 12)).toBe(100);
  });
});
