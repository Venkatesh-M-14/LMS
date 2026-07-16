/**
 * Streak logic — pure, timezone-correct, DST-safe. Activity dates are compared
 * as user-local calendar dates (YYYY-MM-DD), never as 24-hour deltas, so a
 * spring-forward day is still "one day later".
 */

/** The user-local calendar date for an instant, as YYYY-MM-DD. */
export function localDate(instant: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD; the timeZone option does the local shift.
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  } catch {
    // Unknown timezone → fall back to UTC calendar date.
    return instant.toISOString().slice(0, 10);
  }
}

/** Difference in calendar days between two YYYY-MM-DD strings (b - a). */
export function dayDiff(a: string, b: string): number {
  const da = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const db = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((db - da) / 86_400_000);
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
}

export interface StreakUpdate extends StreakState {
  /** True when this activity advanced the streak to a new day. */
  advanced: boolean;
}

/**
 * Applies an activity on `today` (a user-local date) to prior streak state.
 * - same day as last activity → no change (already counted)
 * - exactly the next day → streak + 1
 * - a gap (or first ever) → streak resets to 1
 */
export function applyActivity(prior: StreakState, today: string): StreakUpdate {
  if (prior.lastActivityDate === today) {
    return { ...prior, advanced: false };
  }

  const gap = prior.lastActivityDate === '' ? Infinity : dayDiff(prior.lastActivityDate, today);
  const currentStreak = gap === 1 ? prior.currentStreak + 1 : 1;
  const longestStreak = Math.max(prior.longestStreak, currentStreak);

  return { currentStreak, longestStreak, lastActivityDate: today, advanced: true };
}
