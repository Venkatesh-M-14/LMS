import { Prisma } from '@prisma/client';
import type {
  AnalyticsFunnelStep,
  AnalyticsTimePoint,
  AnalyticsTopLesson,
  AnalyticsTotals,
} from '@academy/shared';
import type { PrismaClient } from '../../../core/db/prisma';
import type { AnalyticsEventRecord, AnalyticsRepository } from '../application/ports';

const FUNNEL: Array<{ step: AnalyticsFunnelStep['step']; label: string }> = [
  { step: 'lesson.opened', label: 'Opened a lesson' },
  { step: 'quiz.started', label: 'Started a quiz' },
  { step: 'quiz.submitted', label: 'Submitted a quiz' },
  { step: 'quiz.passed', label: 'Passed a quiz' },
];

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insertMany(events: AnalyticsEventRecord[]): Promise<number> {
    if (events.length === 0) return 0;
    const { count } = await this.prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        userId: e.userId,
        name: e.name,
        props: (e.props ?? undefined) as Prisma.InputJsonValue | undefined,
        sessionId: e.sessionId,
        occurredAt: e.occurredAt,
      })),
    });
    return count;
  }

  async totals(sinceIso: string): Promise<AnalyticsTotals> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        active_learners: number;
        lessons_opened: number;
        quizzes_submitted: number;
        quizzes_passed: number;
        events_captured: number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT "userId")::int AS active_learners,
        COUNT(*) FILTER (WHERE name = 'lesson.opened')::int AS lessons_opened,
        COUNT(*) FILTER (WHERE name = 'quiz.submitted')::int AS quizzes_submitted,
        COUNT(*) FILTER (WHERE name = 'quiz.passed')::int AS quizzes_passed,
        COUNT(*)::int AS events_captured
      FROM analytics_events
      WHERE "occurredAt" >= ${sinceIso}::timestamptz
    `);
    const r = rows[0] ?? {
      active_learners: 0,
      lessons_opened: 0,
      quizzes_submitted: 0,
      quizzes_passed: 0,
      events_captured: 0,
    };
    const passRate =
      r.quizzes_submitted > 0 ? Math.round((r.quizzes_passed / r.quizzes_submitted) * 100) : 0;
    return {
      activeLearners: r.active_learners,
      lessonsOpened: r.lessons_opened,
      quizzesSubmitted: r.quizzes_submitted,
      quizPassRate: passRate,
      eventsCaptured: r.events_captured,
    };
  }

  async timeseries(sinceIso: string): Promise<AnalyticsTimePoint[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        day: string;
        active_learners: number;
        lessons_opened: number;
        quizzes_submitted: number;
      }>
    >(Prisma.sql`
      SELECT
        to_char(date_trunc('day', "occurredAt"), 'YYYY-MM-DD') AS day,
        COUNT(DISTINCT "userId")::int AS active_learners,
        COUNT(*) FILTER (WHERE name = 'lesson.opened')::int AS lessons_opened,
        COUNT(*) FILTER (WHERE name = 'quiz.submitted')::int AS quizzes_submitted
      FROM analytics_events
      WHERE "occurredAt" >= ${sinceIso}::timestamptz
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((r) => ({
      day: r.day,
      activeLearners: r.active_learners,
      lessonsOpened: r.lessons_opened,
      quizzesSubmitted: r.quizzes_submitted,
    }));
  }

  async topLessons(sinceIso: string, limit: number): Promise<AnalyticsTopLesson[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ lesson_id: string; title: string; opens: number }>
    >(Prisma.sql`
      SELECT ae.props->>'lessonId' AS lesson_id, l.title AS title, COUNT(*)::int AS opens
      FROM analytics_events ae
      JOIN lessons l ON l.id = ae.props->>'lessonId'
      WHERE ae.name = 'lesson.opened'
        AND ae."occurredAt" >= ${sinceIso}::timestamptz
        AND ae.props->>'lessonId' IS NOT NULL
      GROUP BY 1, l.title
      ORDER BY opens DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({ lessonId: r.lesson_id, title: r.title, opens: r.opens }));
  }

  async funnel(sinceIso: string): Promise<AnalyticsFunnelStep[]> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; count: number }>>(Prisma.sql`
      SELECT name, COUNT(*)::int AS count
      FROM analytics_events
      WHERE name IN ('lesson.opened', 'quiz.started', 'quiz.submitted', 'quiz.passed')
        AND "occurredAt" >= ${sinceIso}::timestamptz
      GROUP BY name
    `);
    const counts = new Map(rows.map((r) => [r.name, r.count]));
    return FUNNEL.map((f) => ({ step: f.step, label: f.label, count: counts.get(f.step) ?? 0 }));
  }
}
