import { ACHIEVEMENT_RULES, earnedSlugs, type AchievementContext } from '../achievements';
import { levelForXp, xpThresholdForLevel } from '@academy/shared';

const base: AchievementContext = {
  lessonsCompleted: 0,
  quizzesPassed: 0,
  perfectQuizzes: 0,
  projectsApproved: 0,
  currentStreak: 0,
  level: 1,
  totalXp: 0,
};

describe('achievement rules', () => {
  it('a blank slate earns nothing', () => {
    expect(earnedSlugs(base)).toEqual([]);
  });

  it('completing one lesson earns First Steps', () => {
    expect(earnedSlugs({ ...base, lessonsCompleted: 1 })).toContain('first-steps');
  });

  it('five lessons earns both First Steps and Scholar', () => {
    const earned = earnedSlugs({ ...base, lessonsCompleted: 5 });
    expect(earned).toEqual(expect.arrayContaining(['first-steps', 'scholar']));
  });

  it('a perfect quiz earns Quiz Taker and Flawless once a quiz is passed', () => {
    const earned = earnedSlugs({ ...base, quizzesPassed: 1, perfectQuizzes: 1 });
    expect(earned).toEqual(expect.arrayContaining(['quiz-taker', 'flawless']));
  });

  it('streak thresholds unlock progressively', () => {
    expect(earnedSlugs({ ...base, currentStreak: 3 })).toContain('on-a-roll');
    expect(earnedSlugs({ ...base, currentStreak: 3 })).not.toContain('dedicated');
    expect(earnedSlugs({ ...base, currentStreak: 7 })).toEqual(
      expect.arrayContaining(['on-a-roll', 'dedicated']),
    );
  });

  it('an approved project earns Shipper', () => {
    expect(earnedSlugs({ ...base, projectsApproved: 1 })).toContain('shipper');
  });

  it('reaching level 5 earns Rising Star', () => {
    expect(earnedSlugs({ ...base, level: 5 })).toContain('level-five');
  });

  it('every rule has a unique slug', () => {
    const slugs = ACHIEVEMENT_RULES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('level curve', () => {
  it('thresholds increase and the first level starts at 0', () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(300);
    expect(xpThresholdForLevel(2)).toBeLessThan(xpThresholdForLevel(3));
  });

  it('levelForXp is the inverse of the thresholds', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });
});
