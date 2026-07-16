import type { NotificationListView } from '@academy/shared';
import type { Logger } from '../../../core/logging/logger';
import type { DomainEvents } from '../../../core/events/eventBus';
import {
  achievementNotification,
  certificateNotification,
  projectReviewedNotification,
  quizGradedNotification,
  revisionAssignedNotification,
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

  // ── Event subscribers ───────────────────────────────────────────────────────

  onAttemptGraded(event: DomainEvents['AttemptGraded']): Promise<void> {
    return this.create(event.userId, quizGradedNotification(event));
  }
  onAchievementUnlocked(event: DomainEvents['AchievementUnlocked']): Promise<void> {
    return this.create(event.userId, achievementNotification(event));
  }
  onCertificateIssued(event: DomainEvents['CertificateIssued']): Promise<void> {
    return this.create(event.userId, certificateNotification(event));
  }
  onProjectReviewed(event: DomainEvents['ProjectReviewed']): Promise<void> {
    return this.create(event.userId, projectReviewedNotification(event));
  }
  onRevisionAssigned(event: DomainEvents['RevisionAssigned']): Promise<void> {
    return this.create(event.userId, revisionAssignedNotification(event));
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
}
