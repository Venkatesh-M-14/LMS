/**
 * Attempt admission rules: resume, attempt limits, and retake cooldowns.
 * Pure — the service supplies the attempt history and the clock.
 */

export interface AttemptFacts {
  id: string;
  status: 'IN_PROGRESS' | 'GRADING' | 'GRADED';
  submittedAt: Date | null;
}

export interface PolicySettings {
  maxAttempts: number | null;
  cooldownMinutes: number;
}

export interface StartDecision {
  canStart: boolean;
  blockedReason: 'MAX_ATTEMPTS' | 'COOLDOWN' | null;
  cooldownEndsAt: Date | null;
  /** An unfinished attempt to resume instead of creating a new one. */
  resumeAttemptId: string | null;
}

export function evaluateStartPolicy(
  settings: PolicySettings,
  attempts: AttemptFacts[],
  now: Date,
): StartDecision {
  const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
  if (inProgress) {
    return {
      canStart: true,
      blockedReason: null,
      cooldownEndsAt: null,
      resumeAttemptId: inProgress.id,
    };
  }

  const finished = attempts.filter((a) => a.status !== 'IN_PROGRESS');

  if (settings.maxAttempts !== null && finished.length >= settings.maxAttempts) {
    return {
      canStart: false,
      blockedReason: 'MAX_ATTEMPTS',
      cooldownEndsAt: null,
      resumeAttemptId: null,
    };
  }

  if (settings.cooldownMinutes > 0) {
    const lastSubmitted = finished
      .map((a) => a.submittedAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (lastSubmitted) {
      const endsAt = new Date(lastSubmitted.getTime() + settings.cooldownMinutes * 60_000);
      if (endsAt > now) {
        return {
          canStart: false,
          blockedReason: 'COOLDOWN',
          cooldownEndsAt: endsAt,
          resumeAttemptId: null,
        };
      }
    }
  }

  return { canStart: true, blockedReason: null, cooldownEndsAt: null, resumeAttemptId: null };
}
