import { Prisma } from '@prisma/client';
import {
  levelForXp,
  type AchievementView,
  type CertificateSummary,
  type CertificateVerification,
} from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import { ACHIEVEMENT_RULES, type AchievementContext } from '../domain/achievements';
import { applyActivity, type StreakState } from '../domain/streak';
import type {
  AwardInput,
  GamificationRepository,
  LeaderboardSliceRow,
  StatsRow,
  XpReason,
} from '../application/ports';

export class PrismaGamificationRepository implements GamificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone || 'UTC';
  }

  async getStreakState(userId: string): Promise<StreakState> {
    const stats = await this.prisma.userStats.findUnique({ where: { userId } });
    return {
      currentStreak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      lastActivityDate: stats?.lastActivityDate ?? '',
    };
  }

  getStats(userId: string): Promise<StatsRow | null> {
    return this.prisma.userStats.findUnique({
      where: { userId },
      select: {
        totalXp: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
        lastActivityDate: true,
      },
    });
  }

  /**
   * Atomic idempotent award. The unique idempotencyKey makes the ledger insert
   * the concurrency guard: a duplicate throws P2002 and the whole transaction
   * is a no-op (returns null). On success, stats are projected in the same tx.
   */
  async award(input: AwardInput, streakToday: string): Promise<StatsRow | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.xpTransaction.create({
          data: {
            userId: input.userId,
            amount: input.amount,
            reason: input.reason as XpReason,
            idempotencyKey: input.idempotencyKey,
            refType: input.refType ?? '',
            refId: input.refId ?? '',
          },
        });

        const existing = await tx.userStats.findUnique({ where: { userId: input.userId } });
        const priorStreak: StreakState = {
          currentStreak: existing?.currentStreak ?? 0,
          longestStreak: existing?.longestStreak ?? 0,
          lastActivityDate: existing?.lastActivityDate ?? '',
        };
        const streak = applyActivity(priorStreak, streakToday);
        const totalXp = (existing?.totalXp ?? 0) + input.amount;
        const level = levelForXp(totalXp);

        const stats = await tx.userStats.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            totalXp,
            level,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastActivityDate: streak.lastActivityDate,
          },
          update: {
            totalXp,
            level,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastActivityDate: streak.lastActivityDate,
          },
          select: {
            totalXp: true,
            level: true,
            currentStreak: true,
            longestStreak: true,
            lastActivityDate: true,
          },
        });
        return stats;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null; // replay: award already applied
      }
      throw error;
    }
  }

  async getAchievementContext(userId: string): Promise<AchievementContext> {
    const [lessonsCompleted, quizzesPassed, perfectQuizzes, projectsApproved, stats] =
      await Promise.all([
        this.prisma.progressRecord.count({
          where: { userId, unitType: 'LESSON', status: 'COMPLETED' },
        }),
        this.prisma.xpTransaction.count({ where: { userId, reason: 'QUIZ_PASSED' } }),
        this.prisma.xpTransaction.count({ where: { userId, reason: 'QUIZ_PASSED_FIRST_TRY' } }),
        this.prisma.projectSubmission.count({ where: { userId, status: 'APPROVED' } }),
        this.prisma.userStats.findUnique({ where: { userId } }),
      ]);
    const totalXp = stats?.totalXp ?? 0;
    return {
      lessonsCompleted,
      quizzesPassed,
      perfectQuizzes,
      projectsApproved,
      currentStreak: stats?.currentStreak ?? 0,
      level: levelForXp(totalXp),
      totalXp,
    };
  }

  async listAchievements(userId: string): Promise<AchievementView[]> {
    const [defs, earned] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);
    const earnedBySlug = new Map<string, Date>();
    const bySlug = new Map(defs.map((def) => [def.id, def.slug]));
    for (const record of earned) {
      const slug = bySlug.get(record.achievementId);
      if (slug) earnedBySlug.set(slug, record.earnedAt);
    }
    return defs.map((def) => ({
      slug: def.slug,
      title: def.title,
      description: def.description,
      icon: def.icon,
      xpReward: def.xpReward,
      earned: earnedBySlug.has(def.slug),
      earnedAt: earnedBySlug.get(def.slug)?.toISOString() ?? null,
    }));
  }

  async grantAchievements(userId: string, slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const defs = await this.prisma.achievement.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const owned = await this.prisma.userAchievement.findMany({
      where: { userId, achievementId: { in: defs.map((d) => d.id) } },
      select: { achievementId: true },
    });
    const ownedIds = new Set(owned.map((o) => o.achievementId));
    const toGrant = defs.filter((def) => !ownedIds.has(def.id));
    if (toGrant.length === 0) return [];

    await this.prisma.userAchievement.createMany({
      data: toGrant.map((def) => ({ userId, achievementId: def.id })),
      skipDuplicates: true,
    });
    return toGrant.map((def) => def.slug);
  }

  getAllStatsForRebuild(): Promise<Array<{ userId: string; totalXp: number }>> {
    return this.prisma.userStats.findMany({ select: { userId: true, totalXp: true } });
  }

  /**
   * Score plus curriculum progress, so the circle sees how far each member
   * actually is — not just their XP (M10).
   */
  async getLeaderboardSlice(userIds: string[]): Promise<LeaderboardSliceRow[]> {
    const [stats, totalLessons, completedGroups, inProgress] = await Promise.all([
      this.prisma.userStats.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          totalXp: true,
          level: true,
          user: { select: { displayName: true } },
        },
      }),
      this.prisma.lesson.count({ where: { currentPublishedVersionId: { not: null } } }),
      this.prisma.progressRecord.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, unitType: 'LESSON', status: 'COMPLETED' },
        _count: { _all: true },
      }),
      // Newest first, so the first row per user is what they're on right now.
      this.prisma.progressRecord.findMany({
        where: { userId: { in: userIds }, unitType: 'LESSON', status: 'IN_PROGRESS' },
        orderBy: { updatedAt: 'desc' },
        select: { userId: true, unitId: true },
      }),
    ]);

    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: [...new Set(inProgress.map((p) => p.unitId))] } },
      select: { id: true, topic: { select: { title: true } } },
    });
    const topicByLesson = new Map(lessons.map((l) => [l.id, l.topic.title]));
    const currentTopicByUser = new Map<string, string>();
    for (const record of inProgress) {
      if (currentTopicByUser.has(record.userId)) continue;
      const topic = topicByLesson.get(record.unitId);
      if (topic) currentTopicByUser.set(record.userId, topic);
    }
    const completedByUser = new Map(completedGroups.map((g) => [g.userId, g._count._all]));

    return stats.map((row) => ({
      userId: row.userId,
      displayName: row.user.displayName,
      totalXp: row.totalXp,
      level: row.level,
      lessonsCompleted: completedByUser.get(row.userId) ?? 0,
      totalLessons,
      currentTopicTitle: currentTopicByUser.get(row.userId) ?? null,
    }));
  }

  // ── Certificates ────────────────────────────────────────────────────────────

  async listCompletedModulesNeedingCertificate(
    userId: string,
  ): Promise<Array<{ id: string; title: string }>> {
    const completed = await this.prisma.progressRecord.findMany({
      where: { userId, unitType: 'MODULE', status: 'COMPLETED' },
      select: { unitId: true },
    });
    if (completed.length === 0) return [];
    const moduleIds = completed.map((record) => record.unitId);

    const [modules, existingCerts] = await Promise.all([
      this.prisma.module.findMany({
        where: { id: { in: moduleIds } },
        select: { id: true, title: true },
      }),
      this.prisma.certificate.findMany({
        where: { userId, scope: 'MODULE', scopeId: { in: moduleIds } },
        select: { scopeId: true },
      }),
    ]);
    const certified = new Set(existingCerts.map((cert) => cert.scopeId));
    return modules.filter((module) => !certified.has(module.id));
  }

  async getPathCertificateStatus(userId: string) {
    const path = await this.prisma.path.findFirst({
      where: { isActive: true },
      include: {
        modules: {
          include: {
            topics: { include: { lessons: { select: { currentPublishedVersionId: true } } } },
          },
        },
      },
    });
    if (!path) return null;

    // Modules that contain at least one published lesson must all be completed.
    const contentModuleIds = path.modules
      .filter((module) =>
        module.topics.some((topic) =>
          topic.lessons.some((lesson) => lesson.currentPublishedVersionId !== null),
        ),
      )
      .map((module) => module.id);

    const completedCount = await this.prisma.progressRecord.count({
      where: { userId, unitType: 'MODULE', status: 'COMPLETED', unitId: { in: contentModuleIds } },
    });
    const hasCertificate =
      (await this.prisma.certificate.count({
        where: { userId, scope: 'PATH', scopeId: path.id },
      })) > 0;

    return {
      pathId: path.id,
      title: path.title,
      complete: contentModuleIds.length > 0 && completedCount === contentModuleIds.length,
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
  }): Promise<{ id: string } | null> {
    try {
      const created = await this.prisma.certificate.create({ data: input, select: { id: true } });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null; // already issued
      }
      throw error;
    }
  }

  async listCertificates(userId: string): Promise<CertificateSummary[]> {
    const certs = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });
    return certs.map((cert) => ({
      id: cert.id,
      scope: cert.scope,
      scopeTitle: cert.scopeTitle,
      serial: cert.serial,
      verificationCode: cert.verificationCode,
      issuedAt: cert.issuedAt.toISOString(),
    }));
  }

  async verifyCertificate(code: string): Promise<CertificateVerification> {
    const cert = await this.prisma.certificate.findUnique({
      where: { verificationCode: code },
      include: { user: { select: { displayName: true } } },
    });
    if (!cert) {
      return {
        valid: false,
        serial: null,
        holderName: null,
        scope: null,
        scopeTitle: null,
        issuedAt: null,
      };
    }
    return {
      valid: true,
      serial: cert.serial,
      holderName: cert.user.displayName,
      scope: cert.scope,
      scopeTitle: cert.scopeTitle,
      issuedAt: cert.issuedAt.toISOString(),
    };
  }
}

/** Seed achievement definitions from the rule list (idempotent by slug). */
export async function seedAchievementDefinitions(prisma: PrismaClient): Promise<void> {
  for (const rule of ACHIEVEMENT_RULES) {
    await prisma.achievement.upsert({
      where: { slug: rule.slug },
      update: {
        title: rule.title,
        description: rule.description,
        icon: rule.icon,
        xpReward: rule.xpReward,
        order: rule.order,
      },
      create: {
        slug: rule.slug,
        title: rule.title,
        description: rule.description,
        icon: rule.icon,
        xpReward: rule.xpReward,
        order: rule.order,
      },
    });
  }
}
