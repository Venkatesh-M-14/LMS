import type { AnalyticsDashboardView } from '@academy/shared';
import { apiRequest } from '../../shared/api/client';

export const analyticsKeys = {
  dashboard: (windowDays: number) => ['analytics', 'dashboard', windowDays] as const,
};

export function fetchAnalyticsDashboard(windowDays: number): Promise<AnalyticsDashboardView> {
  return apiRequest(`/analytics/dashboard?windowDays=${windowDays}`);
}
