import type { AnalyticsDashboardView, AnalyticsEventInput } from '@academy/shared';
import type { Clock } from '../../auth/application/ports';
import type { Logger } from '../../../core/logging/logger';
import type { DomainEvents } from '../../../core/events/eventBus';
import type { AnalyticsEventRecord, AnalyticsRepository } from './ports';

export interface AnalyticsServiceDeps {
  repo: AnalyticsRepository;
  clock: Clock;
  logger?: Logger;
}

/** Server clamps client timestamps to a sane recent window. */
const MAX_SKEW_MS = 24 * 60 * 60 * 1000;

export class AnalyticsService {
  constructor(private readonly deps: AnalyticsServiceDeps) {}

  /** Batch-ingest client events; server stamps user + clamps the timestamp. */
  async ingest(userId: string | null, events: AnalyticsEventInput[]): Promise<number> {
    const now = this.deps.clock.now();
    const records: AnalyticsEventRecord[] = events.map((e) => ({
      userId,
      name: e.name,
      props: e.props ?? null,
      sessionId: e.sessionId ?? null,
      occurredAt: this.clampTime(e.occurredAt, now),
    }));
    return this.deps.repo.insertMany(records);
  }

  /** Server-side capture: a graded attempt is authoritative funnel data. */
  async onAttemptGraded(event: DomainEvents['AttemptGraded']): Promise<void> {
    const now = this.deps.clock.now();
    const base = { userId: event.userId, sessionId: null, occurredAt: now };
    const records: AnalyticsEventRecord[] = [
      {
        ...base,
        name: 'quiz.submitted',
        props: { assessmentId: event.assessmentId, lessonId: event.lessonId, scorePct: event.scorePct },
      },
    ];
    if (event.passed) {
      records.push({
        ...base,
        name: 'quiz.passed',
        props: { assessmentId: event.assessmentId, lessonId: event.lessonId },
      });
    }
    await this.deps.repo.insertMany(records);
  }

  /** Server-side capture of a lesson open (from the curriculum read). */
  async recordLessonOpened(userId: string, lessonId: string): Promise<void> {
    await this.deps.repo.insertMany([
      { userId, name: 'lesson.opened', props: { lessonId }, sessionId: null, occurredAt: this.deps.clock.now() },
    ]);
  }

  async getDashboard(windowDays: number): Promise<AnalyticsDashboardView> {
    const days = Math.min(90, Math.max(1, windowDays));
    const since = new Date(this.deps.clock.now().getTime() - days * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();
    const [totals, timeseries, topLessons, funnel] = await Promise.all([
      this.deps.repo.totals(sinceIso),
      this.deps.repo.timeseries(sinceIso),
      this.deps.repo.topLessons(sinceIso, 5),
      this.deps.repo.funnel(sinceIso),
    ]);
    return { windowDays: days, totals, timeseries, topLessons, funnel };
  }

  private clampTime(iso: string | undefined, now: Date): Date {
    if (!iso) return now;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return now;
    // Reject implausible future/past timestamps; keep the stream trustworthy.
    if (t > now.getTime() + MAX_SKEW_MS || t < now.getTime() - MAX_SKEW_MS * 90) return now;
    return new Date(t);
  }
}
