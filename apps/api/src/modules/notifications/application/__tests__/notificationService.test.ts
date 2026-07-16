import type { NotificationPreferences, NotificationView } from '@academy/shared';
import { NotificationService } from '../notificationService';
import type { CreateNotificationInput, NotificationRepository, PeerPreference } from '../ports';

/** Tracks who each notification went to, so fan-out is observable. */
class FakeRepo implements NotificationRepository {
  rows: Array<NotificationView & { userId: string }> = [];
  peers: string[] = [];
  admins: string[] = [];
  names = new Map<string, string>();
  prefs = new Map<string, NotificationPreferences>();
  private seq = 0;

  async create(input: CreateNotificationInput): Promise<NotificationView> {
    const row = {
      id: `n-${this.seq++}`,
      userId: input.userId,
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
  async createMany(inputs: CreateNotificationInput[]): Promise<NotificationView[]> {
    return Promise.all(inputs.map((input) => this.create(input)));
  }
  async list(userId: string, limit: number): Promise<NotificationView[]> {
    return this.rows.filter((r) => r.userId === userId).slice(0, limit);
  }
  async unreadCount(userId: string): Promise<number> {
    return this.rows.filter((r) => r.userId === userId && !r.read).length;
  }
  async markRead(userId: string, ids: string[] | null): Promise<number> {
    for (const r of this.rows) {
      if (r.userId === userId && (ids === null || ids.includes(r.id))) r.read = true;
    }
    return this.rows.filter((r) => r.userId === userId && !r.read).length;
  }
  async listPeerRecipients(exceptUserId: string, pref: PeerPreference): Promise<string[]> {
    return this.peers.filter((id) => id !== exceptUserId && (this.prefs.get(id)?.[pref] ?? true));
  }
  async listAdmins(): Promise<string[]> {
    return this.admins;
  }
  async wants(userId: string, pref: PeerPreference): Promise<boolean> {
    return this.prefs.get(userId)?.[pref] ?? true;
  }
  async displayName(userId: string): Promise<string | null> {
    return this.names.get(userId) ?? null;
  }
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return (
      this.prefs.get(userId) ?? {
        notifyPeerSuccess: true,
        notifyOvertaken: true,
        emailMilestones: true,
      }
    );
  }
  async updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const next = { ...(await this.getPreferences(userId)), ...patch };
    this.prefs.set(userId, next);
    return next;
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
    // The actor's own notification + a peer fan-out to whoever is subscribed.
    expect(repo.rows.filter((r) => r.userId === 'u')).toHaveLength(1);
  });
});

describe('NotificationService peer fan-out (M10)', () => {
  it('tells the circle when someone succeeds, minus the actor', async () => {
    const repo = new FakeRepo();
    repo.peers = ['actor', 'bob', 'carol'];
    repo.names.set('actor', 'Alice');
    const service = new NotificationService({ repo });

    await service.onAttemptGraded({
      userId: 'actor', attemptId: 'a', assessmentId: 'as', lessonId: 'l', passed: true, scorePct: 90,
    });

    const peerRows = repo.rows.filter((r) => r.type === 'PEER_SUCCESS');
    expect(peerRows.map((r) => r.userId).sort()).toEqual(['bob', 'carol']);
    expect(peerRows[0]!.title).toContain('Alice');
  });

  it('does not fan out a failed quiz', async () => {
    const repo = new FakeRepo();
    repo.peers = ['actor', 'bob'];
    const service = new NotificationService({ repo });

    await service.onAttemptGraded({
      userId: 'actor', attemptId: 'a', assessmentId: 'as', lessonId: 'l', passed: false, scorePct: 10,
    });

    expect(repo.rows.filter((r) => r.type === 'PEER_SUCCESS')).toHaveLength(0);
  });

  it('respects a peer who muted others’ wins', async () => {
    const repo = new FakeRepo();
    repo.peers = ['actor', 'bob', 'muted'];
    repo.prefs.set('muted', { notifyPeerSuccess: false, notifyOvertaken: true, emailMilestones: true });
    const service = new NotificationService({ repo });

    await service.onAchievementUnlocked({ userId: 'actor', slug: 's', title: 'Streak', xpReward: 0 });

    const peers = repo.rows.filter((r) => r.type === 'PEER_SUCCESS').map((r) => r.userId);
    expect(peers).toEqual(['bob']);
  });

  it('only notifies an overtaken user who wants it', async () => {
    const repo = new FakeRepo();
    repo.prefs.set('loser', { notifyPeerSuccess: true, notifyOvertaken: false, emailMilestones: true });
    const service = new NotificationService({ repo });

    await service.onLeaderboardOvertaken({ overtakenUserId: 'loser', byUserId: 'winner', byDisplayName: 'Win', newRank: 2 });

    expect(repo.rows.filter((r) => r.type === 'OVERTAKEN')).toHaveLength(0);
  });

  it('notifies admins of a new suggestion', async () => {
    const repo = new FakeRepo();
    repo.admins = ['admin1', 'admin2'];
    const service = new NotificationService({ repo });

    await service.onSuggestionSubmitted({ suggestionId: 's', userId: 'stu', authorName: 'Sam', kind: 'IDEA' });

    expect(repo.rows.filter((r) => r.type === 'SUGGESTION_SUBMITTED').map((r) => r.userId).sort()).toEqual([
      'admin1',
      'admin2',
    ]);
  });
});
