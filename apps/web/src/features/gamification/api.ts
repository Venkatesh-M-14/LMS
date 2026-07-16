import type {
  AchievementView,
  CertificateSummary,
  CertificateVerification,
  LeaderboardView,
  UserStatsView,
} from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const gamificationKeys = {
  stats: ['gamification', 'stats'] as const,
  achievements: ['gamification', 'achievements'] as const,
  leaderboard: ['gamification', 'leaderboard'] as const,
  certificates: ['gamification', 'certificates'] as const,
};

export function fetchStats(): Promise<UserStatsView> {
  return apiRequest('/gamification/stats');
}

export function fetchAchievements(): Promise<AchievementView[]> {
  return apiRequest('/gamification/achievements');
}

export function fetchLeaderboard(): Promise<LeaderboardView> {
  return apiRequest('/gamification/leaderboard');
}

export function fetchCertificates(): Promise<CertificateSummary[]> {
  return apiRequest('/gamification/certificates');
}

/** Public — no auth. */
export function verifyCertificate(code: string): Promise<CertificateVerification> {
  return apiRequest(`/verify/${code}`);
}
