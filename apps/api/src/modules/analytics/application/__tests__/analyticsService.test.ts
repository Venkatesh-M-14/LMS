import type {
  AnalyticsFunnelStep,
  AnalyticsTimePoint,
  AnalyticsTopLesson,
  AnalyticsTotals,
} from '@academy/shared';
import { MutableClock } from '../../../auth/application/__tests__/fakes';
import { AnalyticsService } from '../analyticsService';
import type { AnalyticsEventRecord, AnalyticsRepository } from '../ports';

class FakeRepo implements AnalyticsRepository {
  inserted: AnalyticsEventRecord[] = [];
  lastSince = '';

  async insertMany(events: AnalyticsEventRecord[]): Promise<number> {
    this.inserted.push(...events);
    return events.length;
  }
  async totals(since: string): Promise<AnalyticsTotals> {
    this.lastSince = since;
    return { activeLearners: 0, lessonsOpened: 0, quizzesSubmitted: 0, quizPassRate: 0, eventsCaptured: 0 };
  }
  async timeseries(): Promise<AnalyticsTimePoint[]> {
    return [];
  }
  async topLessons(): Promise<AnalyticsTopLesson[]> {
    return [];
  }
  async funnel(): Promise<AnalyticsFunnelStep[]> {
    return [];
  }
}

const NOW = new Date('2026-07-16T12:00:00.000Z');

describe('AnalyticsService.ingest', () => {
  it('stamps the user and keeps a valid client timestamp', async () => {
    const repo = new FakeRepo();
    const service = new AnalyticsService({ repo, clock: new MutableClock(NOW) });

    const at = '2026-07-16T11:59:00.000Z';
    await service.ingest('u1', [{ name: 'lesson.opened', props: { lessonId: 'l1' }, occurredAt: at }]);

    expect(repo.inserted[0]).toMatchObject({ userId: 'u1', name: 'lesson.opened' });
    expect(repo.inserted[0]!.occurredAt.toISOString()).toBe(at);
  });

  it('clamps an implausible future timestamp to now', async () => {
    const repo = new FakeRepo();
    const service = new AnalyticsService({ repo, clock: new MutableClock(NOW) });

    await service.ingest('u1', [{ name: 'page.view', occurredAt: '2030-01-01T00:00:00.000Z' }]);

    expect(repo.inserted[0]!.occurredAt.toISOString()).toBe(NOW.toISOString());
  });
});

describe('AnalyticsService server capture', () => {
  it('records quiz.submitted and quiz.passed for a passed attempt', async () => {
    const repo = new FakeRepo();
    const service = new AnalyticsService({ repo, clock: new MutableClock(NOW) });

    await service.onAttemptGraded({ userId: 'u1', attemptId: 'a', assessmentId: 'as1', lessonId: 'l1', passed: true, scorePct: 80 });

    expect(repo.inserted.map((e) => e.name)).toEqual(['quiz.submitted', 'quiz.passed']);
  });

  it('records only quiz.submitted for a failed attempt', async () => {
    const repo = new FakeRepo();
    const service = new AnalyticsService({ repo, clock: new MutableClock(NOW) });

    await service.onAttemptGraded({ userId: 'u1', attemptId: 'a', assessmentId: 'as1', lessonId: 'l1', passed: false, scorePct: 20 });

    expect(repo.inserted.map((e) => e.name)).toEqual(['quiz.submitted']);
  });
});

describe('AnalyticsService.getDashboard', () => {
  it('clamps the window and queries from the right start time', async () => {
    const repo = new FakeRepo();
    const service = new AnalyticsService({ repo, clock: new MutableClock(NOW) });

    const view = await service.getDashboard(7);

    expect(view.windowDays).toBe(7);
    const expectedSince = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(repo.lastSince).toBe(expectedSince);
  });

  it('caps an oversized window at 90 days', async () => {
    const repo = new FakeRepo();
    const service = new AnalyticsService({ repo, clock: new MutableClock(NOW) });
    const view = await service.getDashboard(9999);
    expect(view.windowDays).toBe(90);
  });
});
