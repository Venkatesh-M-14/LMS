import { evaluateStartPolicy, type AttemptFacts } from '../attemptPolicy';

const NOW = new Date('2026-07-16T10:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const graded = (submittedAt: Date): AttemptFacts => ({
  id: `a-${submittedAt.getTime()}`,
  status: 'GRADED',
  submittedAt,
});

describe('evaluateStartPolicy', () => {
  it('always resumes an in-progress attempt, even when limits are exhausted', () => {
    const decision = evaluateStartPolicy(
      { maxAttempts: 1, cooldownMinutes: 60 },
      [{ id: 'open', status: 'IN_PROGRESS', submittedAt: null }],
      NOW,
    );
    expect(decision).toEqual({
      canStart: true,
      blockedReason: null,
      cooldownEndsAt: null,
      resumeAttemptId: 'open',
    });
  });

  it('blocks when finished attempts reach maxAttempts', () => {
    const decision = evaluateStartPolicy(
      { maxAttempts: 2, cooldownMinutes: 0 },
      [graded(minutesAgo(100)), graded(minutesAgo(50))],
      NOW,
    );
    expect(decision.canStart).toBe(false);
    expect(decision.blockedReason).toBe('MAX_ATTEMPTS');
  });

  it('GRADING attempts count toward the limit', () => {
    const decision = evaluateStartPolicy(
      { maxAttempts: 1, cooldownMinutes: 0 },
      [{ id: 'g', status: 'GRADING', submittedAt: minutesAgo(5) }],
      NOW,
    );
    expect(decision.blockedReason).toBe('MAX_ATTEMPTS');
  });

  it('blocks during the cooldown window and reports when it ends', () => {
    const decision = evaluateStartPolicy(
      { maxAttempts: null, cooldownMinutes: 30 },
      [graded(minutesAgo(10))],
      NOW,
    );
    expect(decision.canStart).toBe(false);
    expect(decision.blockedReason).toBe('COOLDOWN');
    expect(decision.cooldownEndsAt).toEqual(new Date(NOW.getTime() + 20 * 60_000));
  });

  it('allows a retake once the cooldown has elapsed', () => {
    const decision = evaluateStartPolicy(
      { maxAttempts: null, cooldownMinutes: 30 },
      [graded(minutesAgo(31))],
      NOW,
    );
    expect(decision.canStart).toBe(true);
    expect(decision.blockedReason).toBeNull();
  });

  it('unlimited attempts, no cooldown, clean history → start', () => {
    const decision = evaluateStartPolicy({ maxAttempts: null, cooldownMinutes: 0 }, [], NOW);
    expect(decision.canStart).toBe(true);
  });
});
