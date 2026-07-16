import { randomBytes, randomUUID } from 'node:crypto';
import {
  levelProgress,
  type AchievementView,
  type CertificateSummary,
  type CertificateVerification,
  type LeaderboardView,
  type UserStatsView,
} from '@academy/shared';
import type { Clock } from '../../auth/application/ports';
import type { EventBus } from '../../../core/events/eventBus';
import type { Logger } from '../../../core/logging/logger';
import { earnedSlugs, ACHIEVEMENT_RULES } from '../domain/achievements';
import { localDate } from '../domain/streak';
import type { AwardInput, GamificationRepository, Leaderboard, XpReason } from './ports';

/** A single climb can pass many people; cap the notifications it fans out. */
const OVERTAKE_NOTIFY_CAP = 10;

/** XP awarded per event type. Achievement rewards come from their own rules. */
const XP_VALUES = {
  LESSON_COMPLETED: 20,
  QUIZ_PASSED: 30,
  QUIZ_PASSED_FIRST_TRY: 15, // bonus on top of QUIZ_PASSED
  PROJECT_APPROVED: 100,
} as const;

export interface GamificationServiceDeps {
  repo: GamificationRepository;
  leaderboard: Leaderboard;
  clock: Clock;
  events?: EventBus;
  logger?: Logger;
}

export class GamificationService {
  constructor(private readonly deps: GamificationServiceDeps) {}

  // ── Event handlers (subscribed on the event bus) ────────────────────────────

  async onAttemptGraded(event: {
    userId: string;
    assessmentId: string;
    lessonId: string | null;
    passed: boolean;
    scorePct: number;
  }): Promise<void> {
    if (!event.passed) return;
    await this.withOvertakeDetection(event.userId, async () => {
      // Deterministic keys: replays (retries, re-grades) never double-award.
      await this.award({
        userId: event.userId,
        amount: XP_VALUES.QUIZ_PASSED,
        reason: 'QUIZ_PASSED',
        idempotencyKey: `quiz-passed:${event.userId}:${event.assessmentId}`,
        refType: 'assessment',
        refId: event.assessmentId,
      });
      if (event.scorePct >= 100) {
        await this.award({
          userId: event.userId,
          amount: XP_VALUES.QUIZ_PASSED_FIRST_TRY,
          reason: 'QUIZ_PASSED_FIRST_TRY',
          idempotencyKey: `quiz-perfect:${event.userId}:${event.assessmentId}`,
          refType: 'assessment',
          refId: event.assessmentId,
        });
      }
      if (event.lessonId) {
        await this.award({
          userId: event.userId,
          amount: XP_VALUES.LESSON_COMPLETED,
          reason: 'LESSON_COMPLETED',
          idempotencyKey: `lesson:${event.userId}:${event.lessonId}`,
          refType: 'lesson',
          refId: event.lessonId,
        });
      }
      await this.syncAchievements(event.userId);
    });
    await this.maybeIssueCertificates(event.userId);
  }

  /** Quizless lesson manually completed — award lesson XP and check certs. */
  async onLessonCompleted(event: { userId: string; lessonId: string }): Promise<void> {
    await this.withOvertakeDetection(event.userId, async () => {
      await this.award({
        userId: event.userId,
        amount: XP_VALUES.LESSON_COMPLETED,
        reason: 'LESSON_COMPLETED',
        idempotencyKey: `lesson:${event.userId}:${event.lessonId}`,
        refType: 'lesson',
        refId: event.lessonId,
      });
      await this.syncAchievements(event.userId);
    });
    await this.maybeIssueCertificates(event.userId);
  }

  async onProjectApproved(event: {
    userId: string;
    briefId: string;
    topicId: string;
  }): Promise<void> {
    await this.withOvertakeDetection(event.userId, async () => {
      await this.award({
        userId: event.userId,
        amount: XP_VALUES.PROJECT_APPROVED,
        reason: 'PROJECT_APPROVED',
        idempotencyKey: `project:${event.userId}:${event.briefId}`,
        refType: 'brief',
        refId: event.briefId,
      });
      await this.syncAchievements(event.userId);
    });
  }

  // ── Overtake detection ──────────────────────────────────────────────────────

  /**
   * Wraps a batch of awards and reports who the user climbed past. Rank is read
   * once before and once after the whole batch, so one quiz that grants several
   * XP entries still produces a single set of overtake events rather than one
   * per award. Ranks are 1-based and lower is better.
   */
  private async withOvertakeDetection(userId: string, apply: () => Promise<void>): Promise<void> {
    const events = this.deps.events;
    if (!events) {
      await apply();
      return;
    }
    const before = await this.deps.leaderboard.rankOf(userId);
    await apply();
    const after = await this.deps.leaderboard.rankOf(userId);
    if (before === null || after === null || after >= before) return;

    // Everyone previously ranked [after, before-1] is now one place lower.
    const passed = (await this.deps.leaderboard.rangeByRank(after + 1, before)).filter(
      (id) => id !== userId,
    );
    if (passed.length === 0) return;

    const [me] = await this.deps.repo.getLeaderboardSlice([userId]);
    const byDisplayName = me?.displayName ?? 'Someone';
    for (const overtakenUserId of passed.slice(0, OVERTAKE_NOTIFY_CAP)) {
      await events.emit('LeaderboardOvertaken', {
        overtakenUserId,
        byUserId: userId,
        byDisplayName,
        newRank: after,
      });
    }
  }

  // ── Core award ──────────────────────────────────────────────────────────────

  /** Idempotent XP grant; updates the Redis leaderboard on a real insert. */
  private async award(input: AwardInput): Promise<void> {
    const timezone = await this.deps.repo.getUserTimezone(input.userId);
    const today = localDate(this.deps.clock.now(), timezone);
    const stats = await this.deps.repo.award(input, today);
    if (stats) {
      await this.deps.leaderboard.addXp(input.userId, stats.totalXp);
    } else {
      this.deps.logger?.debug({ key: input.idempotencyKey }, 'XP award replay ignored');
    }
  }

  private async syncAchievements(userId: string): Promise<void> {
    const context = await this.deps.repo.getAchievementContext(userId);
    const earned = earnedSlugs(context);
    const granted = await this.deps.repo.grantAchievements(userId, earned);
    // Achievement XP rewards are themselves idempotent ledger entries.
    for (const slug of granted) {
      const rule = ACHIEVEMENT_RULES.find((r) => r.slug === slug);
      if (rule && rule.xpReward > 0) {
        await this.award({
          userId,
          amount: rule.xpReward,
          reason: 'ACHIEVEMENT_EARNED',
          idempotencyKey: `achievement:${userId}:${slug}`,
          refType: 'achievement',
          refId: slug,
        });
      }
      if (rule) {
        await this.deps.events?.emit('AchievementUnlocked', {
          userId,
          slug,
          title: rule.title,
          xpReward: rule.xpReward,
        });
      }
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getStats(userId: string): Promise<UserStatsView> {
    const stats = await this.deps.repo.getStats(userId);
    const totalXp = stats?.totalXp ?? 0;
    const progress = levelProgress(totalXp);
    const today = localDate(this.deps.clock.now(), await this.deps.repo.getUserTimezone(userId));
    return {
      totalXp,
      level: progress.level,
      levelXp: progress.levelXp,
      nextLevelXp: progress.nextLevelXp,
      currentStreak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      activeToday: (stats?.lastActivityDate ?? '') === today,
    };
  }

  listAchievements(userId: string): Promise<AchievementView[]> {
    return this.deps.repo.listAchievements(userId);
  }

  async getLeaderboard(userId: string, limit = 20): Promise<LeaderboardView> {
    let top = await this.deps.leaderboard.topEntries(limit);
    if (top.length === 0) {
      // Cold Redis: rebuild from the ledger-backed stats.
      const all = await this.deps.repo.getAllStatsForRebuild();
      await this.deps.leaderboard.rebuild(all);
      top = await this.deps.leaderboard.topEntries(limit);
    }

    const userIds = top.map((entry) => entry.userId);
    const includesCurrent = userIds.includes(userId);
    if (!includesCurrent) userIds.push(userId);

    const resolved = await this.deps.repo.getLeaderboardSlice(userIds);
    const ranks = new Map<string, number>();
    for (const [index, entry] of top.entries()) ranks.set(entry.userId, index + 1);

    const currentRank = includesCurrent ? null : await this.deps.leaderboard.rankOf(userId);
    if (currentRank !== null) ranks.set(userId, currentRank);

    const entries = this.deps.leaderboard.toEntries(resolved, ranks, userId);
    const topEntries = entries
      .filter((entry) => entry.rank <= limit)
      .sort((a, b) => a.rank - b.rank);
    const currentUser = entries.find((entry) => entry.isCurrentUser) ?? null;

    return { entries: topEntries, currentUser };
  }

  // ── Certificates ────────────────────────────────────────────────────────────

  /**
   * Issues any module/path certificates the user has newly earned. Driven by
   * completion (progress records), so it self-heals: a missed issuance is
   * picked up on the next event. Idempotent on (user, scope, scopeId).
   */
  private async maybeIssueCertificates(userId: string): Promise<void> {
    const modules = await this.deps.repo.listCompletedModulesNeedingCertificate(userId);
    for (const module of modules) {
      await this.issue(userId, 'MODULE', module.id, module.title);
    }

    const pathStatus = await this.deps.repo.getPathCertificateStatus(userId);
    if (pathStatus && pathStatus.complete && !pathStatus.hasCertificate) {
      await this.issue(userId, 'PATH', pathStatus.pathId, pathStatus.title);
    }
  }

  private async issue(
    userId: string,
    scope: 'MODULE' | 'PATH',
    scopeId: string,
    scopeTitle: string,
  ): Promise<void> {
    const serial = `FEA-${scope[0]}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const verificationCode = randomUUID();
    const issued = await this.deps.repo.issueCertificate({
      userId,
      scope,
      scopeId,
      scopeTitle,
      serial,
      verificationCode,
    });
    if (issued) {
      this.deps.logger?.info({ userId, scope, scopeId }, 'Certificate issued');
      await this.deps.events?.emit('CertificateIssued', {
        userId,
        certificateId: issued.id,
        scope,
        scopeTitle,
        verificationCode,
      });
    }
  }

  listCertificates(userId: string): Promise<CertificateSummary[]> {
    return this.deps.repo.listCertificates(userId);
  }

  verifyCertificate(code: string): Promise<CertificateVerification> {
    return this.deps.repo.verifyCertificate(code);
  }

  reasonXp(reason: XpReason): number {
    return reason in XP_VALUES ? XP_VALUES[reason as keyof typeof XP_VALUES] : 0;
  }
}
