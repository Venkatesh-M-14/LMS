/**
 * Achievement rules — pure predicates over a user's aggregate progress. The
 * engine evaluates every rule after each XP-earning event and awards any newly
 * satisfied ones (idempotently, via UserAchievement's composite key).
 */

export interface AchievementContext {
  lessonsCompleted: number;
  quizzesPassed: number;
  perfectQuizzes: number;
  projectsApproved: number;
  currentStreak: number;
  level: number;
  totalXp: number;
}

export interface AchievementRule {
  slug: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  order: number;
  isEarned: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    slug: 'first-steps',
    title: 'First Steps',
    description: 'Complete your first lesson.',
    icon: 'Footprint',
    xpReward: 10,
    order: 1,
    isEarned: (c) => c.lessonsCompleted >= 1,
  },
  {
    slug: 'quiz-taker',
    title: 'Quiz Taker',
    description: 'Pass your first quiz.',
    icon: 'Quiz',
    xpReward: 15,
    order: 2,
    isEarned: (c) => c.quizzesPassed >= 1,
  },
  {
    slug: 'flawless',
    title: 'Flawless',
    description: 'Score 100% on a quiz.',
    icon: 'Verified',
    xpReward: 25,
    order: 3,
    isEarned: (c) => c.perfectQuizzes >= 1,
  },
  {
    slug: 'shipper',
    title: 'Shipper',
    description: 'Get a project approved.',
    icon: 'RocketLaunch',
    xpReward: 40,
    order: 4,
    isEarned: (c) => c.projectsApproved >= 1,
  },
  {
    slug: 'on-a-roll',
    title: 'On a Roll',
    description: 'Reach a 3-day learning streak.',
    icon: 'LocalFireDepartment',
    xpReward: 30,
    order: 5,
    isEarned: (c) => c.currentStreak >= 3,
  },
  {
    slug: 'dedicated',
    title: 'Dedicated',
    description: 'Reach a 7-day learning streak.',
    icon: 'Whatshot',
    xpReward: 70,
    order: 6,
    isEarned: (c) => c.currentStreak >= 7,
  },
  {
    slug: 'scholar',
    title: 'Scholar',
    description: 'Complete five lessons.',
    icon: 'School',
    xpReward: 50,
    order: 7,
    isEarned: (c) => c.lessonsCompleted >= 5,
  },
  {
    slug: 'level-five',
    title: 'Rising Star',
    description: 'Reach level 5.',
    icon: 'Star',
    xpReward: 0,
    order: 8,
    isEarned: (c) => c.level >= 5,
  },
];

/** Slugs whose rules the context now satisfies. */
export function earnedSlugs(ctx: AchievementContext): string[] {
  return ACHIEVEMENT_RULES.filter((rule) => rule.isEarned(ctx)).map((rule) => rule.slug);
}
