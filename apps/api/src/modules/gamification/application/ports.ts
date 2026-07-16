import type {
  AchievementView,
  CertificateSummary,
  CertificateVerification,
  LeaderboardEntry,
} from '@academy/shared';
import type { StreakState } from '../domain/streak';
import type { AchievementContext } from '../domain/achievements';

export type XpReason =
  | 'LESSON_COMPLETED'
  | 'QUIZ_PASSED'
  | 'QUIZ_PASSED_FIRST_TRY'
  | 'PROJECT_APPROVED'
  | 'ACHIEVEMENT_EARNED'
  | 'STREAK_BONUS';

export interface AwardInput {
  userId: string;
  amount: number;
  reason: XpReason;
  idempotencyKey: string;
  refType?: string;
  refId?: string;
}

export interface StatsRow {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
}

export interface GamificationRepository {
  getUserTimezone(userId: string): Promise<string>;

  /**
   * Idempotently inserts an XP ledger row and applies its effects (XP + level
   * + streak) to UserStats in ONE transaction. Returns the fresh stats, or
   * null when the key already existed (a no-op replay).
   */
  award(input: AwardInput, streakToday: string): Promise<StatsRow | null>;

  getStats(userId: string): Promise<StatsRow | null>;
  getStreakState(userId: string): Promise<StreakState>;

  getAchievementContext(userId: string): Promise<AchievementContext>;
  listAchievements(userId: string): Promise<AchievementView[]>;
  /** Records newly-earned achievements (skips already-owned); returns the count actually inserted. */
  grantAchievements(userId: string, slugs: string[]): Promise<string[]>;

  // Leaderboard (Postgres source of truth; Redis is the fast index).
  getAllStatsForRebuild(): Promise<Array<{ userId: string; totalXp: number }>>;
  getLeaderboardSlice(userIds: string[]): Promise<LeaderboardSliceRow[]>;

  // Certificates
  /** Modules the user has COMPLETED (progress) but has no certificate for yet. */
  listCompletedModulesNeedingCertificate(
    userId: string,
  ): Promise<Array<{ id: string; title: string }>>;
  /** The active path + whether every content-bearing module is complete, and if a cert exists. */
  getPathCertificateStatus(
    userId: string,
  ): Promise<{ pathId: string; title: string; complete: boolean; hasCertificate: boolean } | null>;
  /** Creates the certificate, or returns null if one already exists (idempotent). */
  issueCertificate(input: {
    userId: string;
    scope: 'MODULE' | 'PATH';
    scopeId: string;
    scopeTitle: string;
    serial: string;
    verificationCode: string;
  }): Promise<{ id: string } | null>;
  listCertificates(userId: string): Promise<CertificateSummary[]>;
  verifyCertificate(code: string): Promise<CertificateVerification>;
}

/** One row behind a leaderboard entry: score plus curriculum progress (M10). */
export interface LeaderboardSliceRow {
  userId: string;
  displayName: string;
  totalXp: number;
  level: number;
  lessonsCompleted: number;
  totalLessons: number;
  currentTopicTitle: string | null;
}

export interface Leaderboard {
  /** Adds delta XP for a user in the ZSET (rebuilds from Postgres if empty). */
  addXp(userId: string, totalXp: number): Promise<void>;
  topEntries(limit: number): Promise<Array<{ userId: string; totalXp: number }>>;
  rankOf(userId: string): Promise<number | null>;
  /** User ids occupying an inclusive 1-based rank range — powers overtake detection. */
  rangeByRank(fromRank: number, toRank: number): Promise<string[]>;
  rebuild(all: Array<{ userId: string; totalXp: number }>): Promise<void>;
  toEntries(
    resolved: LeaderboardSliceRow[],
    ranks: Map<string, number>,
    currentUserId: string,
  ): LeaderboardEntry[];
}
