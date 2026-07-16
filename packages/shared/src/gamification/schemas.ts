/** Gamification & certificates: XP, streaks, achievements, leaderboard. */

export interface UserStatsView {
  totalXp: number;
  level: number;
  /** XP into the current level and what the next level needs. */
  levelXp: number;
  nextLevelXp: number;
  currentStreak: number;
  longestStreak: number;
  /** True when the user has already been active today (in their timezone). */
  activeToday: boolean;
}

export interface AchievementView {
  slug: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalXp: number;
  level: number;
  isCurrentUser: boolean;
}

export interface LeaderboardView {
  entries: LeaderboardEntry[];
  /** The caller's own rank, even if outside the top slice. */
  currentUser: LeaderboardEntry | null;
}

export interface CertificateSummary {
  id: string;
  scope: 'MODULE' | 'PATH';
  scopeTitle: string;
  serial: string;
  verificationCode: string;
  issuedAt: string;
}

/** The public (unauthenticated) verification payload. */
export interface CertificateVerification {
  valid: boolean;
  serial: string | null;
  holderName: string | null;
  scope: 'MODULE' | 'PATH' | null;
  scopeTitle: string | null;
  issuedAt: string | null;
}

/**
 * Level curve: level n requires a cumulative XP threshold. Kept in shared so
 * the web app can render progress bars without a round-trip. Quadratic-ish:
 * each level costs a bit more than the last.
 */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  // 0, 100, 250, 450, 700, 1000, ... (100 * (n-1) * n / 2)
  const n = level - 1;
  return 50 * n * (n + 1);
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  while (xpThresholdForLevel(level + 1) <= totalXp) level++;
  return level;
}

export function levelProgress(totalXp: number): {
  level: number;
  levelXp: number;
  nextLevelXp: number;
} {
  const level = levelForXp(totalXp);
  const base = xpThresholdForLevel(level);
  const next = xpThresholdForLevel(level + 1);
  return { level, levelXp: totalXp - base, nextLevelXp: next - base };
}
