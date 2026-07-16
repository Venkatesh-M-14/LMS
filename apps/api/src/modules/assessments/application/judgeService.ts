import type { Logger } from '../../../core/logging/logger';
import { scoreFromRunResults } from '../domain/grading';
import { parseSnapshot, toTypedItem } from '../domain/snapshot';
import type { SandboxOutcome, SandboxRequest } from '../../judge/infrastructure/subprocessSandbox';
import type { AttemptFinalizer } from './attemptFinalizer';
import type { AttemptRepository } from './ports';

export interface JudgeServiceDeps {
  attempts: AttemptRepository;
  /** The sandbox executor (subprocess today; swappable per the design). */
  sandbox: (request: SandboxRequest) => Promise<SandboxOutcome>;
  finalizer: AttemptFinalizer;
  logger?: Logger;
}

/**
 * Processes one ExecutionRun: loads the frozen challenge from the attempt
 * snapshot (never the live DB — challenge edits cannot affect in-flight
 * attempts), executes in the sandbox, scores by test weights, and finalizes
 * the attempt when it was the last pending grade.
 */
export class JudgeService {
  constructor(private readonly deps: JudgeServiceDeps) {}

  async processRun(runId: string): Promise<void> {
    const claim = await this.deps.attempts.claimRun(runId);
    if (!claim) return; // already processed or gone — BullMQ retry safety

    const attempt = await this.deps.attempts.findById(claim.attemptId);
    if (!attempt) return;

    const snapshotItem = parseSnapshot(attempt.itemsSnapshot).find(
      (item) => item.itemId === claim.itemId,
    );
    if (!snapshotItem) {
      await this.fail(claim, 'Snapshot item missing for this run');
      return;
    }

    const typed = toTypedItem(snapshotItem);
    if (typed.type !== 'CODING' && typed.type !== 'DEBUGGING') {
      await this.fail(claim, 'Run references a non-coding item');
      return;
    }

    const frozen = typed.payload;
    const tests = frozen.tests ?? [];
    if (tests.length === 0) {
      await this.fail(claim, 'Challenge has no test cases');
      return;
    }

    const outcome = await this.deps.sandbox({
      environment: frozen.environment ?? 'JS',
      files: claim.files,
      tests,
      timeLimitMs: frozen.timeLimitMs ?? 5000,
      memoryLimitMb: frozen.memoryLimitMb ?? 128,
    });

    const testById = new Map(tests.map((test) => [test.id, test]));
    const results = outcome.results.map((result) => {
      const test = testById.get(result.testId);
      return {
        testId: result.testId,
        name: result.name,
        passed: result.passed,
        message: test?.isHidden ? '' : result.message, // hidden details stay hidden
        hidden: test?.isHidden ?? false,
        weight: test?.weight ?? 1,
        durationMs: result.durationMs,
      };
    });

    // Timeouts and crashes score zero; missing tests count as failed.
    const scored =
      outcome.status === 'COMPLETED'
        ? tests.map((test) => ({
            passed: results.find((r) => r.testId === test.id)?.passed ?? false,
            weight: test.weight,
          }))
        : tests.map((test) => ({ passed: false, weight: test.weight }));
    const autoScore = scoreFromRunResults(snapshotItem.points, scored);

    const status =
      outcome.status === 'COMPLETED'
        ? results.length > 0 && results.every((r) => r.passed)
          ? 'PASSED'
          : 'FAILED'
        : outcome.status; // TIMEOUT | ERROR

    await this.deps.attempts.completeRun(runId, claim.submissionId, {
      status,
      resultsJson: results,
      stdout: outcome.stdout,
      errorMessage: outcome.errorMessage,
      durationMs: outcome.durationMs,
      autoScore,
    });

    await this.deps.finalizer.finalizeIfComplete(claim.attemptId);
    this.deps.logger?.info(
      { runId, attemptId: claim.attemptId, status, autoScore },
      'Judge run completed',
    );
  }

  private async fail(
    claim: { runId: string; submissionId: string; attemptId: string },
    message: string,
  ): Promise<void> {
    await this.deps.attempts.completeRun(claim.runId, claim.submissionId, {
      status: 'ERROR',
      resultsJson: [],
      stdout: '',
      errorMessage: message,
      durationMs: 0,
      autoScore: 0,
    });
    await this.deps.finalizer.finalizeIfComplete(claim.attemptId);
  }
}
