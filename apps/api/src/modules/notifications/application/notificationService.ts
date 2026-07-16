import type { NotificationListView, NotificationPreferences } from '@academy/shared';
import type { Logger } from '../../../core/logging/logger';
import type { DomainEvents } from '../../../core/events/eventBus';
import {
  achievementNotification,
  certificateNotification,
  overtakenNotification,
  peerSuccessNotification,
  projectReviewedNotification,
  quizGradedNotification,
  revisionAssignedNotification,
  suggestionReviewedNotification,
  suggestionSubmittedNotification,
  type NotificationContent,
} from '../domain/templates';
import type { NotificationPusher, NotificationRepository } from './ports';

export interface NotificationServiceDeps {
  repo: NotificationRepository;
  logger?: Logger;
}

const LIST_LIMIT = 50;

/** No-op default; server.ts swaps in a Socket.IO-backed pusher after boot. */
const NOOP_PUSHER: NotificationPusher = { push: () => {} };

export class NotificationService {
  private pusher: NotificationPusher = NOOP_PUSHER;

  constructor(private readonly deps: NotificationServiceDeps) {}

  /** Wire the realtime push once the Socket.IO server exists. */
  setPusher(pusher: NotificationPusher): void {
    this.pusher = pusher;
  }

  async list(userId: string): Promise<NotificationListView> {
    const [items, unreadCount] = await Promise.all([
      this.deps.repo.list(userId, LIST_LIMIT),
      this.deps.repo.unreadCount(userId),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, ids: string[] | null): Promise<{ unreadCount: number }> {
    const unreadCount = await this.deps.repo.markRead(userId, ids);
    return { unreadCount };
  }

  getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.deps.repo.getPreferences(userId);
  }

  updatePreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    return this.deps.repo.updatePreferences(userId, patch);
  }

  // ── Event subscribers: your own results ─────────────────────────────────────

  async onAttemptGraded(event: DomainEvents['AttemptGraded']): Promise<void> {
    await this.create(event.userId, quizGradedNotification(event));
    if (event.passed) await this.fanOutPeerSuccess(event.userId, 'passed a quiz', '/leaderboard');
  }
  async onAchievementUnlocked(event: DomainEvents['AchievementUnlocked']): Promise<void> {
    await this.create(event.userId, achievementNotification(event));
    await this.fanOutPeerSuccess(event.userId, `earned "${event.title}"`, '/leaderboard');
  }
  async onCertificateIssued(event: DomainEvents['CertificateIssued']): Promise<void> {
    await this.create(event.userId, certificateNotification(event));
    const scope = event.scope === 'PATH' ? 'the learning path' : `"${event.scopeTitle}"`;
    await this.fanOutPeerSuccess(event.userId, `completed ${scope} 🎓`, '/leaderboard');
  }
  onProjectReviewed(event: DomainEvents['ProjectReviewed']): Promise<void> {
    return this.create(event.userId, projectReviewedNotification(event));
  }
  onRevisionAssigned(event: DomainEvents['RevisionAssigned']): Promise<void> {
    return this.create(event.userId, revisionAssignedNotification(event));
  }

  // ── Event subscribers: the circle ───────────────────────────────────────────

  /** Only the overtaken peer hears about it, and only if they want to. */
  async onLeaderboardOvertaken(event: DomainEvents['LeaderboardOvertaken']): Promise<void> {
    if (!(await this.deps.repo.wants(event.overtakenUserId, 'notifyOvertaken'))) return;
    await this.create(event.overtakenUserId, overtakenNotification(event));
  }

  async onSuggestionSubmitted(event: DomainEvents['SuggestionSubmitted']): Promise<void> {
    const admins = await this.deps.repo.listAdmins();
    const content = suggestionSubmittedNotification(event);
    await this.createFor(admins, content);
  }

  onSuggestionReviewed(event: DomainEvents['SuggestionReviewed']): Promise<void> {
    return this.create(event.userId, suggestionReviewedNotification(event));
  }

  /**
   * Tells the rest of the circle about one member's win. In-app only —
   * milestone emails are the email module's job. Respects the opt-out.
   */
  private async fanOutPeerSuccess(
    actorId: string,
    achievement: string,
    linkUrl: string | null,
  ): Promise<void> {
    const [recipients, actorName] = await Promise.all([
      this.deps.repo.listPeerRecipients(actorId, 'notifyPeerSuccess'),
      this.deps.repo.displayName(actorId),
    ]);
    if (recipients.length === 0) return;
    await this.createFor(
      recipients,
      peerSuccessNotification({ actorName: actorName ?? 'A member', achievement, linkUrl }),
    );
  }

  private async create(userId: string, content: NotificationContent): Promise<void> {
    const notification = await this.deps.repo.create({ userId, ...content });
    const unreadCount = await this.deps.repo.unreadCount(userId);
    // Best-effort realtime nudge; the badge is authoritative from the list query.
    try {
      this.pusher.push(userId, { notification, unreadCount });
    } catch (err) {
      this.deps.logger?.warn({ err, userId }, 'Notification push failed');
    }
  }

  /** One insert for the whole circle, then a push per recipient. */
  private async createFor(userIds: string[], content: NotificationContent): Promise<void> {
    if (userIds.length === 0) return;
    const created = await this.deps.repo.createMany(
      userIds.map((userId) => ({ userId, ...content })),
    );
    await Promise.all(
      created.map(async (notification, index) => {
        const userId = userIds[index];
        if (!userId) return;
        try {
          const unreadCount = await this.deps.repo.unreadCount(userId);
          this.pusher.push(userId, { notification, unreadCount });
        } catch (err) {
          this.deps.logger?.warn({ err, userId }, 'Notification push failed');
        }
      }),
    );
  }
}
