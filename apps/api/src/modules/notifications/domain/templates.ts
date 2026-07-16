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

// ── The circle (M10) ─────────────────────────────────────────────────────────

/** What the rest of the circle sees when someone succeeds. */
export function peerSuccessNotification(input: {
  actorName: string;
  achievement: string;
  linkUrl: string | null;
}): NotificationContent {
  return {
    type: 'PEER_SUCCESS',
    title: `${input.actorName} ${input.achievement}`,
    body: 'Your circle is making progress — see where everyone is up to.',
    linkUrl: input.linkUrl ?? '/leaderboard',
  };
}

export function overtakenNotification(
  event: DomainEvents['LeaderboardOvertaken'],
): NotificationContent {
  return {
    type: 'OVERTAKEN',
    title: `${event.byDisplayName} just passed you`,
    body: `They're now #${event.newRank} on the leaderboard. Your move.`,
    linkUrl: '/leaderboard',
  };
}

export function suggestionSubmittedNotification(
  event: DomainEvents['SuggestionSubmitted'],
): NotificationContent {
  const what = event.kind === 'DRAFT_QUESTION' ? 'a draft question' : 'a syllabus idea';
  return {
    type: 'SUGGESTION_SUBMITTED',
    title: 'New syllabus suggestion',
    body: `${event.authorName} submitted ${what} for review.`,
    linkUrl: '/instructor/suggestions',
  };
}

export function suggestionReviewedNotification(
  event: DomainEvents['SuggestionReviewed'],
): NotificationContent {
  return event.accepted
    ? {
        type: 'SUGGESTION_REVIEWED',
        title: 'Your suggestion was accepted 🎉',
        body: event.createdItemId
          ? 'Your draft question is now part of the syllabus.'
          : 'Thanks — your idea has been accepted.',
        linkUrl: '/suggestions',
      }
    : {
        type: 'SUGGESTION_REVIEWED',
        title: 'Your suggestion was reviewed',
        body: 'It was not accepted this time — open it to see the reviewer’s note.',
        linkUrl: '/suggestions',
      };
}
