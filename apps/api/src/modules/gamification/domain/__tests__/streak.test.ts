import { applyActivity, dayDiff, localDate } from '../streak';

describe('localDate', () => {
  it('shifts an instant to the user-local calendar date', () => {
    // 2026-07-16T02:30Z is still 2026-07-15 in America/Los_Angeles (UTC-7).
    const instant = new Date('2026-07-16T02:30:00Z');
    expect(localDate(instant, 'America/Los_Angeles')).toBe('2026-07-15');
    expect(localDate(instant, 'UTC')).toBe('2026-07-16');
    // ...and already 2026-07-16 in Asia/Kolkata (UTC+5:30).
    expect(localDate(instant, 'Asia/Kolkata')).toBe('2026-07-16');
  });

  it('falls back to the UTC date for an unknown timezone', () => {
    expect(localDate(new Date('2026-07-16T10:00:00Z'), 'Not/AZone')).toBe('2026-07-16');
  });
});

describe('dayDiff', () => {
  it('counts calendar days, DST-independent', () => {
    expect(dayDiff('2026-03-08', '2026-03-09')).toBe(1); // US spring-forward day
    expect(dayDiff('2026-11-01', '2026-11-02')).toBe(1); // US fall-back day
    expect(dayDiff('2026-07-15', '2026-07-18')).toBe(3);
    expect(dayDiff('2026-07-18', '2026-07-15')).toBe(-3);
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1); // year boundary
  });
});

describe('applyActivity', () => {
  const empty = { currentStreak: 0, longestStreak: 0, lastActivityDate: '' };

  it('starts a streak on first ever activity', () => {
    expect(applyActivity(empty, '2026-07-16')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: '2026-07-16',
      advanced: true,
    });
  });

  it('does nothing when active again the same day', () => {
    const prior = { currentStreak: 3, longestStreak: 5, lastActivityDate: '2026-07-16' };
    expect(applyActivity(prior, '2026-07-16')).toEqual({ ...prior, advanced: false });
  });

  it('extends the streak on a consecutive day', () => {
    const prior = { currentStreak: 3, longestStreak: 5, lastActivityDate: '2026-07-16' };
    expect(applyActivity(prior, '2026-07-17')).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      lastActivityDate: '2026-07-17',
      advanced: true,
    });
  });

  it('raises the longest streak when the current one surpasses it', () => {
    const prior = { currentStreak: 5, longestStreak: 5, lastActivityDate: '2026-07-16' };
    expect(applyActivity(prior, '2026-07-17').longestStreak).toBe(6);
  });

  it('resets to 1 after a gap but preserves the longest', () => {
    const prior = { currentStreak: 8, longestStreak: 8, lastActivityDate: '2026-07-16' };
    expect(applyActivity(prior, '2026-07-19')).toEqual({
      currentStreak: 1,
      longestStreak: 8,
      lastActivityDate: '2026-07-19',
      advanced: true,
    });
  });

  it('spanning a DST transition still counts as consecutive', () => {
    const prior = { currentStreak: 2, longestStreak: 2, lastActivityDate: '2026-03-08' };
    expect(applyActivity(prior, '2026-03-09').currentStreak).toBe(3);
  });
});
