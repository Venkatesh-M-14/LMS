import type { NotificationType } from '@academy/shared';
import type { DomainEvents } from '../../../core/events/eventBus';

export interface NotificationContent {
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
}

/**
 * Pure mappers from domain events to notification content. Kept out of the
 * service so the copy is trivially unit-testable and i18n-ready later.
 */

export function quizGradedNotification(event: DomainEvents['AttemptGraded']): NotificationContent {
  const link = event.lessonId ? `/lessons/${event.lessonId}` : null;
  return event.passed
    ? {
        type: 'QUIZ_PASSED',
        title: 'Quiz passed 🎉',
        body: `You scored ${event.scorePct}% and passed the quiz.`,
        linkUrl: link,
      }
    : {
        type: 'QUIZ_FAILED',
        title: 'Quiz not passed',
        body: `You scored ${event.scorePct}%. Review the lesson and try again.`,
        linkUrl: link,
      };
}

export function achievementNotification(
  event: DomainEvents['AchievementUnlocked'],
): NotificationContent {
  return {
    type: 'ACHIEVEMENT_EARNED',
    title: 'Achievement unlocked 🏅',
    body: `You earned "${event.title}"${event.xpReward > 0 ? ` (+${event.xpReward} XP)` : ''}.`,
    linkUrl: '/achievements',
  };
}

export function certificateNotification(
  event: DomainEvents['CertificateIssued'],
): NotificationContent {
  const scope = event.scope === 'PATH' ? 'learning path' : 'module';
  return {
    type: 'CERTIFICATE_ISSUED',
    title: 'Certificate earned 🎓',
    body: `You completed the ${scope} "${event.scopeTitle}" — your certificate is ready.`,
    linkUrl: '/certificates',
  };
}

export function projectReviewedNotification(
  event: DomainEvents['ProjectReviewed'],
): NotificationContent {
  return event.decision === 'APPROVED'
    ? {
        type: 'PROJECT_REVIEWED',
        title: 'Project approved ✅',
        body: `Your submission for "${event.briefTitle}" was approved.`,
        linkUrl: '/curriculum',
      }
    : {
        type: 'PROJECT_REVIEWED',
        title: 'Changes requested',
        body: `Your reviewer left feedback on "${event.briefTitle}".`,
        linkUrl: '/curriculum',
      };
}

export function revisionAssignedNotification(
  event: DomainEvents['RevisionAssigned'],
): NotificationContent {
  return {
    type: 'REVISION_ASSIGNED',
    title: 'Revision assigned',
    body:
      event.count === 1
        ? `Review "${event.targetLessonTitle}" before retrying the quiz.`
        : `${event.count} skills to revisit — review "${event.targetLessonTitle}" before retrying.`,
    linkUrl: `/lessons/${event.targetLessonId}`,
  };
}
