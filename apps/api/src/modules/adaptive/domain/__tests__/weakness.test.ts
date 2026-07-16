import { detectWeakSkills, type GradedItem } from '../weakness';

const item = (partial: Partial<GradedItem>): GradedItem => ({
  itemId: 'i',
  skillIds: [],
  earned: 0,
  points: 1,
  ...partial,
});

describe('detectWeakSkills', () => {
  it('flags skills on items the learner missed', () => {
    const weak = detectWeakSkills([
      item({ itemId: 'a', skillIds: ['s1'], earned: 0, points: 2 }),
      item({ itemId: 'b', skillIds: ['s2'], earned: 2, points: 2 }),
    ]);
    expect(weak).toEqual(['s1']);
  });

  it('treats a partial score as a miss', () => {
    const weak = detectWeakSkills([
      item({ skillIds: ['partial'], earned: 1, points: 3 }),
    ]);
    expect(weak).toEqual(['partial']);
  });

  it('does not flag fully-correct items', () => {
    const weak = detectWeakSkills([
      item({ skillIds: ['ok'], earned: 3, points: 3 }),
    ]);
    expect(weak).toEqual([]);
  });

  it('collects every skill on a missed multi-skill item', () => {
    const weak = detectWeakSkills([item({ skillIds: ['s1', 's2', 's3'], earned: 0, points: 1 })]);
    expect(weak.sort()).toEqual(['s1', 's2', 's3']);
  });

  it('deduplicates a skill missed across several items', () => {
    const weak = detectWeakSkills([
      item({ itemId: 'a', skillIds: ['dup'], earned: 0, points: 1 }),
      item({ itemId: 'b', skillIds: ['dup'], earned: 0, points: 1 }),
    ]);
    expect(weak).toEqual(['dup']);
  });

  it('ignores untagged items even when missed', () => {
    const weak = detectWeakSkills([item({ skillIds: [], earned: 0, points: 2 })]);
    expect(weak).toEqual([]);
  });

  it('returns nothing for an empty attempt', () => {
    expect(detectWeakSkills([])).toEqual([]);
  });
});
