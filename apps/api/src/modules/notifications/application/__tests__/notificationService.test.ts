import type { NotificationView } from '@academy/shared';
import { NotificationService } from '../notificationService';
import type { CreateNotificationInput, NotificationRepository } from '../ports';

class FakeRepo implements NotificationRepository {
  rows: NotificationView[] = [];
  private seq = 0;

  async create(input: CreateNotificationInput): Promise<NotificationView> {
    const row: NotificationView = {
      id: `n-${this.seq++}`,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      read: false,
      createdAt: '2026-07-16T00:00:00.000Z',
    };
    this.rows.unshift(row);
    return row;
  }
  async list(_userId: string, limit: number): Promise<NotificationView[]> {
    return this.rows.slice(0, limit);
  }
  async unreadCount(): Promise<number> {
    return this.rows.filter((r) => !r.read).length;
  }
  async markRead(_userId: string, ids: string[] | null): Promise<number> {
    for (const r of this.rows) if (ids === null || ids.includes(r.id)) r.read = true;
    return this.rows.filter((r) => !r.read).length;
  }
}

describe('NotificationService', () => {
  it('creates a QUIZ_PASSED notification and pushes it live', async () => {
    const repo = new FakeRepo();
    const service = new NotificationService({ repo });
    const pushes: Array<{ userId: string; unreadCount: number }> = [];
    service.setPusher({ push: (userId, e) => pushes.push({ userId, unreadCount: e.unreadCount }) });

    await service.onAttemptGraded({
      userId: 'u1',
      attemptId: 'a1',
      assessmentId: 'as1',
      lessonId: 'l1',
      passed: true,
      scorePct: 90,
    });

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({ type: 'QUIZ_PASSED', linkUrl: '/lessons/l1' });
    expect(pushes).toEqual([{ userId: 'u1', unreadCount: 1 }]);
  });

  it('maps each domain event to its notification type', async () => {
    const repo = new FakeRepo();
    const service = new NotificationService({ repo });

    await service.onAttemptGraded({ userId: 'u', attemptId: 'a', assessmentId: 'as', lessonId: null, passed: false, scorePct: 10 });
    await service.onAchievementUnlocked({ userId: 'u', slug: 's', title: 'First Steps', xpReward: 25 });
    await service.onCertificateIssued({ userId: 'u', certificateId: 'c', scope: 'MODULE', scopeTitle: 'M', verificationCode: 'v' });
    await service.onProjectReviewed({ userId: 'u', submissionId: 's', briefTitle: 'B', decision: 'APPROVED' });
    await service.onRevisionAssigned({ userId: 'u', assessmentId: 'as', count: 2, targetLessonId: 'l', targetLessonTitle: 'L' });

    expect(repo.rows.map((r) => r.type)).toEqual([
      'REVISION_ASSIGNED',
      'PROJECT_REVIEWED',
      'CERTIFICATE_ISSUED',
      'ACHIEVEMENT_EARNED',
      'QUIZ_FAILED',
    ]);
  });

  it('lists with an unread count and marks all read', async () => {
    const repo = new FakeRepo();
    const service = new NotificationService({ repo });
    await service.onAchievementUnlocked({ userId: 'u', slug: 's1', title: 'A', xpReward: 0 });
    await service.onAchievementUnlocked({ userId: 'u', slug: 's2', title: 'B', xpReward: 0 });

    expect(await service.list('u')).toMatchObject({ unreadCount: 2 });
    expect(await service.markRead('u', null)).toEqual({ unreadCount: 0 });
    expect(await service.list('u')).toMatchObject({ unreadCount: 0 });
  });

  it('survives a pusher that throws', async () => {
    const repo = new FakeRepo();
    const service = new NotificationService({ repo });
    service.setPusher({ push: () => { throw new Error('socket down'); } });
    await expect(
      service.onAchievementUnlocked({ userId: 'u', slug: 's', title: 'A', xpReward: 0 }),
    ).resolves.toBeUndefined();
    expect(repo.rows).toHaveLength(1);
  });
});
