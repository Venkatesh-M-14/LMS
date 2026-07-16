import { z } from 'zod';

/** Product analytics: an append-only client + server event stream, read
 * only through aggregation on the instructor/admin dashboard. */

/** A single client-emitted event. `name` is dot-namespaced (e.g. lesson.opened). */
export const analyticsEventInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(\.[a-z0-9]+)+$/, 'name must be dot-namespaced, e.g. lesson.opened'),
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  sessionId: z.string().min(1).max(64).optional(),
  /** Client timestamp (ISO); the server clamps to now if absent/implausible. */
  occurredAt: z.string().datetime().optional(),
});
export type AnalyticsEventInput = z.infer<typeof analyticsEventInputSchema>;

/** Events are sent in small batches to amortize the request cost. */
export const ingestAnalyticsRequestSchema = z.object({
  events: z.array(analyticsEventInputSchema).min(1).max(50),
});
export type IngestAnalyticsRequest = z.infer<typeof ingestAnalyticsRequestSchema>;

// ── Dashboard (INSTRUCTOR / ADMIN) ───────────────────────────────────────────

export interface AnalyticsTotals {
  /** Distinct users seen in the window. */
  activeLearners: number;
  lessonsOpened: number;
  quizzesSubmitted: number;
  quizPassRate: number; // 0–100
  eventsCaptured: number;
}

export interface AnalyticsTimePoint {
  /** YYYY-MM-DD (UTC). */
  day: string;
  activeLearners: number;
  lessonsOpened: number;
  quizzesSubmitted: number;
}

export interface AnalyticsTopLesson {
  lessonId: string;
  title: string;
  opens: number;
}

/** The engagement funnel over the window. */
export interface AnalyticsFunnelStep {
  step: 'lesson.opened' | 'quiz.started' | 'quiz.submitted' | 'quiz.passed';
  label: string;
  count: number;
}

export interface AnalyticsDashboardView {
  windowDays: number;
  totals: AnalyticsTotals;
  timeseries: AnalyticsTimePoint[];
  topLessons: AnalyticsTopLesson[];
  funnel: AnalyticsFunnelStep[];
}
