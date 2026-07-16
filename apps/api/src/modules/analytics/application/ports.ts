import type {
  AnalyticsFunnelStep,
  AnalyticsTimePoint,
  AnalyticsTopLesson,
  AnalyticsTotals,
} from '@academy/shared';

export interface AnalyticsEventRecord {
  userId: string | null;
  name: string;
  props: Record<string, unknown> | null;
  sessionId: string | null;
  occurredAt: Date;
}

export interface AnalyticsRepository {
  insertMany(events: AnalyticsEventRecord[]): Promise<number>;
  totals(sinceIso: string): Promise<AnalyticsTotals>;
  timeseries(sinceIso: string): Promise<AnalyticsTimePoint[]>;
  topLessons(sinceIso: string, limit: number): Promise<AnalyticsTopLesson[]>;
  funnel(sinceIso: string): Promise<AnalyticsFunnelStep[]>;
}
