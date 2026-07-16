import type {
  AchievementView,
  CertificateSummary,
  CertificateVerification,
  LeaderboardEntry,
} from '@academy/shared';
import { levelForXp } from '@academy/shared';
import { MutableClock } from '../../../auth/application/__tests__/fakes';
import { EventBus } from '../../../../core/events/eventBus';
import { ACHIEVEMENT_RULES, type AchievementContext } from '../../domain/achievements';
import { applyActivity, type StreakState } from '../../domain/streak';
import { GamificationService } from '../gamificationService';
import type {
  AwardInput,
  GamificationRepository,
  Leaderboard,
  LeaderboardSliceRow,
  StatsRow,
} from '../ports';

/** In-memory repository mirroring the SQL idempotency + streak projection. */
class FakeRepo implements GamificationRepository {
  timezone = 'UTC';
  ledgerKeys = new Set<string>();
  stats = new Map<string, StatsRow>();
  ledger: AwardInput[] = [];
  achievementsOwned = new Map<string, Set<string>>();
  projectsApprovedCount = new Map<string, number>();
  completedModules: Array<{ id: string; title: string }> = [];
  certificates: Array<{
    userId: string;
    scope: string;
    scopeId: string;
    scopeTitle: string;
    serial: string;
    code: string;
  }> = [];
  displayNames = new Map<string, string>();
  pathComplete = false;

  async getUserTimezone() {
    return this.timezone;
  }
  async getStreakState(userId: string): Promise<StreakState> {
    const s = this.stats.get(userId);
    return {
      currentStreak: s?.currentStreak ?? 0,
      longestStreak: s?.longestStreak ?? 0,
      lastActivityDate: s?.lastActivityDate ?? '',
    };
  }
  async getStats(userId: string) {
    return this.stats.get(userId) ?? null;
  }

  async award(input: AwardInput, streakToday: string): Promise<StatsRow | null> {
    if (this.ledgerKeys.has(input.idempotencyKey)) return null; // replay
    this.ledgerKeys.add(input.idempotencyKey);
    this.ledger.push(input);

    const prior = this.stats.get(input.userId);
    const priorStreak: StreakState = {
      currentStreak: prior?.currentStreak ?? 0,
      longestStreak: prior?.longestStreak ?? 0,
      lastActivityDate: prior?.lastActivityDate ?? '',
    };
    const streak = applyActivity(priorStreak, streakToday);
    const totalXp = (prior?.totalXp ?? 0) + input.amount;
    const row: StatsRow = {
      totalXp,
      level: levelForXp(totalXp),
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate: streak.lastActivityDate,
    };
    this.stats.set(input.userId, row);
    if (input.reason === 'PROJECT_APPROVED') {
      this.projectsApprovedCount.set(
        input.userId,
        (this.projectsApprovedCount.get(input.userId) ?? 0) + 1,
      );
    }
    return row;
  }

  /** Derived from the recorded ledger + stats, like the real Prisma repo. */
  async getAchievementContext(userId: string): Promise<AchievementContext> {
    const mine = this.ledger.filter((l) => l.userId === userId);
    const stats = this.stats.get(userId);
    return {
      lessonsCompleted: mine.filter((l) => l.reason === 'LESSON_COMPLETED').length,
      quizzesPassed: mine.filter((l) => l.reason === 'QUIZ_PASSED').length,
      perfectQuizzes: mine.filter((l) => l.reason === 'QUIZ_PASSED_FIRST_TRY').length,
      projectsApproved: this.projectsApprovedCount.get(userId) ?? 0,
      currentStreak: stats?.currentStreak ?? 0,
      level: stats?.level ?? 1,
      totalXp: stats?.totalXp ?? 0,
    };
  }
  async listAchievements(userId: string): Promise<AchievementView[]> {
    const owned = this.achievementsOwned.get(userId) ?? new Set();
    return ACHIEVEMENT_RULES.map((rule) => ({
      slug: rule.slug,
      title: rule.title,
      description: rule.description,
      icon: rule.icon,
      xpReward: rule.xpReward,
      earned: owned.has(rule.slug),
      earnedAt: owned.has(rule.slug) ? new Date().toISOString() : null,
    }));
  }
  async grantAchievements(userId: string, slugs: string[]): Promise<string[]> {
    const owned = this.achievementsOwned.get(userId) ?? new Set<string>();
    const fresh = slugs.filter((slug) => !owned.has(slug));
    for (const slug of fresh) owned.add(slug);
    this.achievementsOwned.set(userId, owned);
    return fresh;
  }

  async getAllStatsForRebuild() {
    return [...this.stats.entries()].map(([userId, row]) => ({ userId, totalXp: row.totalXp }));
  }
  lessonsCompletedByUser = new Map<string, number>();
  totalLessons = 18;
  currentTopicByUser = new Map<string, string>();

  async getLeaderboardSlice(userIds: string[]): Promise<LeaderboardSliceRow[]> {
    return userIds
      .filter((id) => this.stats.has(id))
      .map((id) => ({
        userId: id,
        displayName: this.displayNames.get(id) ?? id,
        totalXp: this.stats.get(id)!.totalXp,
        level: this.stats.get(id)!.level,
        lessonsCompleted: this.lessonsCompletedByUser.get(id) ?? 0,
        totalLessons: this.totalLessons,
        currentTopicTitle: this.currentTopicByUser.get(id) ?? null,
      }));
  }

  async listCompletedModulesNeedingCertificate(userId: string) {
    const has = new Set(
      this.certificates
        .filter((c) => c.userId === userId && c.scope === 'MODULE')
        .map((c) => c.scopeId),
    );
    return this.completedModules.filter((m) => !has.has(m.id));
  }
  async getPathCertificateStatus(userId: string) {
    const hasCertificate = this.certificates.some((c) => c.userId === userId && c.scope === 'PATH');
    return {
      pathId: 'path-1',
      title: 'Frontend Engineering',
      complete: this.pathComplete,
      hasCertificate,
    };
  }
  async issueCertificate(input: {
    userId: string;
    scope: 'MODULE' | 'PATH';
    scopeId: string;
    scopeTitle: string;
    serial: string;
    verificationCode: string;
  }) {
    if (
      this.certificates.some(
        (c) => c.userId === input.userId && c.scope === input.scope && c.scopeId === input.scopeId,
      )
    ) {
      return null;
    }
    this.certificates.push({ ...input, code: input.verificationCode });
    return { id: `cert-${this.certificates.length}` };
  }
  async listCertificates(): Promise<CertificateSummary[]> {
    return [];
  }
  async verifyCertificate(): Promise<CertificateVerification> {
    return {
      valid: false,
      serial: null,
      holderName: null,
      scope: null,
      scopeTitle: null,
      issuedAt: null,
    };
  }
}

/** In-memory leaderboard mirroring the ZSET semantics. */
class FakeLeaderboard implements Leaderboard {
  scores = new Map<string, number>();
  async addXp(userId: string, totalXp: number) {
    this.scores.set(userId, totalXp);
  }
  async topEntries(limit: number) {
    return [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, totalXp]) => ({ userId, totalXp }));
  }
  async rankOf(userId: string) {
    const sorted = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
    const index = sorted.findIndex(([id]) => id === userId);
    return index === -1 ? null : index + 1;
  }
  async rangeByRank(fromRank: number, toRank: number) {
    const sorted = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(fromRank - 1, toRank).map(([userId]) => userId);
  }
  async rebuild(all: Array<{ userId: string; totalXp: number }>) {
    this.scores.clear();
    for (const { userId, totalXp } of all) if (totalXp > 0) this.scores.set(userId, totalXp);
  }
  toEntries(
    resolved: LeaderboardSliceRow[],
    ranks: Map<string, number>,
    currentUserId: string,
  ): LeaderboardEntry[] {
    return resolved
      .filter((r) => ranks.has(r.userId))
      .map((r) => ({
        rank: ranks.get(r.userId)!,
        userId: r.userId,
        displayName: r.displayName,
        totalXp: r.totalXp,
        level: r.level,
        lessonsCompleted: r.lessonsCompleted,
        totalLessons: r.totalLessons,
        currentTopicTitle: r.currentTopicTitle,
        isCurrentUser: r.userId === currentUserId,
      }));
  }
}

function makeWorld() {
  const repo = new FakeRepo();
  const leaderboard = new FakeLeaderboard();
  const clock = new MutableClock(new Date('2026-07-16T10:00:00Z'));
  const service = new GamificationService({ repo, leaderboard, clock });
  return { repo, leaderboard, clock, service };
}

describe('leaderboard overtake detection (M10)', () => {
  it('emits LeaderboardOvertaken for each peer the user climbs past', async () => {
    const repo = new FakeRepo();
    const leaderboard = new FakeLeaderboard();
    const clock = new MutableClock(new Date('2026-07-16T10:00:00Z'));
    const events = new EventBus();
    const service = new GamificationService({ repo, leaderboard, clock, events });

    // Rival sits at 40 XP; the climber starts at 0 and will pass them.
    repo.displayNames.set('climber', 'Climber');
    repo.displayNames.set('rival', 'Rival');
    await leaderboard.addXp('rival', 40);
    await leaderboard.addXp('climber', 0);

    const overtaken: Array<{ overtakenUserId: string; byUserId: string }> = [];
    events.on('LeaderboardOvertaken', (e) => void overtaken.push(e));

    // A passed quiz (30 + 20 lesson = 50 XP) lifts the climber above the rival.
    await service.onAttemptGraded({ userId: 'climber', assessmentId: 'a', lessonId: 'l', passed: true, scorePct: 80 });

    expect(overtaken).toEqual([{ overtakenUserId: 'rival', byUserId: 'climber', byDisplayName: 'Climber', newRank: 1 }]);
  });

  it('emits nothing when the user does not pass anyone', async () => {
    const repo = new FakeRepo();
    const leaderboard = new FakeLeaderboard();
    const clock = new MutableClock(new Date('2026-07-16T10:00:00Z'));
    const events = new EventBus();
    const service = new GamificationService({ repo, leaderboard, clock, events });

    repo.displayNames.set('solo', 'Solo');
    await leaderboard.addXp('solo', 0);
    const overtaken: unknown[] = [];
    events.on('LeaderboardOvertaken', (e) => void overtaken.push(e));

    await service.onAttemptGraded({ userId: 'solo', assessmentId: 'a', lessonId: 'l', passed: true, scorePct: 80 });

    expect(overtaken).toHaveLength(0);
  });
});

describe('XP awarding & idempotency', () => {
  it('a passed quiz awards quiz + lesson XP and unlocks starter achievements', async () => {
    const { repo, service } = makeWorld();
    await service.onAttemptGraded({
      userId: 'u1',
      assessmentId: 'a1',
      lessonId: 'l1',
      passed: true,
      scorePct: 80,
    });
    // 30 (quiz) + 20 (lesson) + 10 (first-steps) + 15 (quiz-taker) = 75
    // (achievement context is updated so first-steps/quiz-taker fire)
    expect(repo.stats.get('u1')?.totalXp).toBe(75);
    expect(repo.achievementsOwned.get('u1')).toContain('quiz-taker');
  });

  it('re-processing the same graded event awards nothing more (idempotent)', async () => {
    const { repo, service } = makeWorld();
    const event = { userId: 'u1', assessmentId: 'a1', lessonId: 'l1', passed: true, scorePct: 80 };
    await service.onAttemptGraded(event);
    const afterFirst = repo.stats.get('u1')!.totalXp;
    await service.onAttemptGraded(event); // retry / re-grade replay
    expect(repo.stats.get('u1')!.totalXp).toBe(afterFirst);
    // The core ledger keys are the quiz + lesson awards, not duplicated.
    expect(repo.ledger.filter((l) => l.reason === 'QUIZ_PASSED')).toHaveLength(1);
    expect(repo.ledger.filter((l) => l.reason === 'LESSON_COMPLETED')).toHaveLength(1);
  });

  it('a perfect score adds the first-try bonus', async () => {
    const { repo, service } = makeWorld();
    await service.onAttemptGraded({
      userId: 'u1',
      assessmentId: 'a1',
      lessonId: 'l1',
      passed: true,
      scorePct: 100,
    });
    expect(repo.ledger.some((l) => l.reason === 'QUIZ_PASSED_FIRST_TRY')).toBe(true);
  });

  it('failed attempts award nothing', async () => {
    const { repo, service } = makeWorld();
    await service.onAttemptGraded({
      userId: 'u1',
      assessmentId: 'a1',
      lessonId: 'l1',
      passed: false,
      scorePct: 20,
    });
    expect(repo.stats.get('u1')).toBeUndefined();
  });

  it('an approved project awards project XP once', async () => {
    const { repo, service } = makeWorld();
    await service.onProjectApproved({ userId: 'u1', briefId: 'b1', topicId: 't1' });
    await service.onProjectApproved({ userId: 'u1', briefId: 'b1', topicId: 't1' });
    expect(repo.ledger.filter((l) => l.reason === 'PROJECT_APPROVED')).toHaveLength(1);
  });
});

describe('streak via the service (timezone-aware)', () => {
  it('counts a same-timezone consecutive day as a streak', async () => {
    const { repo, clock, service } = makeWorld();
    await service.onProjectApproved({ userId: 'u1', briefId: 'b1', topicId: 't1' });
    expect(repo.stats.get('u1')?.currentStreak).toBe(1);
    clock.advanceSec(24 * 60 * 60); // next day
    await service.onProjectApproved({ userId: 'u1', briefId: 'b2', topicId: 't2' });
    expect(repo.stats.get('u1')?.currentStreak).toBe(2);
  });
});

describe('leaderboard', () => {
  it('ranks users by XP and finds the caller even outside the top slice', async () => {
    const { repo, service } = makeWorld();
    repo.displayNames.set('u1', 'Ada').set('u2', 'Ben');
    await service.onProjectApproved({ userId: 'u1', briefId: 'b1', topicId: 't1' }); // 100 xp
    await service.onAttemptGraded({
      userId: 'u2',
      assessmentId: 'a1',
      lessonId: 'l1',
      passed: true,
      scorePct: 50,
    }); // 75 xp

    const board = await service.getLeaderboard('u2', 20);
    expect(board.entries[0]?.userId).toBe('u1');
    expect(board.entries[0]?.rank).toBe(1);
    expect(board.currentUser?.userId).toBe('u2');
    expect(board.currentUser?.isCurrentUser).toBe(true);
  });

  it('rebuilds from stats when Redis is cold', async () => {
    const { repo, leaderboard, service } = makeWorld();
    repo.stats.set('u1', {
      totalXp: 200,
      level: 2,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: '',
    });
    repo.displayNames.set('u1', 'Ada');
    leaderboard.scores.clear(); // simulate flush

    const board = await service.getLeaderboard('u1', 20);
    expect(board.entries[0]?.totalXp).toBe(200);
  });
});

describe('certificates', () => {
  it('issues a module certificate when a module completes, only once', async () => {
    const { repo, service } = makeWorld();
    repo.completedModules = [{ id: 'm1', title: 'Foundations of Computing' }];
    await service.onAttemptGraded({
      userId: 'u1',
      assessmentId: 'a1',
      lessonId: 'l1',
      passed: true,
      scorePct: 80,
    });
    expect(repo.certificates.filter((c) => c.scope === 'MODULE')).toHaveLength(1);

    // A subsequent event does not double-issue.
    repo.ledgerKeys.clear(); // allow another award to run maybeIssueCertificates again
    await service.onAttemptGraded({
      userId: 'u1',
      assessmentId: 'a2',
      lessonId: 'l2',
      passed: true,
      scorePct: 80,
    });
    expect(repo.certificates.filter((c) => c.scope === 'MODULE')).toHaveLength(1);
  });

  it('issues a path certificate when the whole path is complete', async () => {
    const { repo, service } = makeWorld();
    repo.pathComplete = true;
    await service.onAttemptGraded({
      userId: 'u1',
      assessmentId: 'a1',
      lessonId: 'l1',
      passed: true,
      scorePct: 80,
    });
    expect(repo.certificates.filter((c) => c.scope === 'PATH')).toHaveLength(1);
  });
});
