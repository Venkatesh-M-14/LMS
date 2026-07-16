import { spawn } from 'node:child_process';
import path from 'node:path';
import type { FrozenTest } from '@academy/shared';

/**
 * Spawns the sandbox runner (one process per run) with the full hardening
 * stack: clean env, Node permission model (fs reads limited to the runner +
 * node_modules, nothing else), memory cap, and a hard SIGKILL deadline.
 */

export interface SandboxRequest {
  environment: 'JS' | 'DOM';
  files: Record<string, string>;
  tests: FrozenTest[];
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface SandboxTestResult {
  testId: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface SandboxOutcome {
  status: 'COMPLETED' | 'TIMEOUT' | 'ERROR';
  results: SandboxTestResult[];
  stdout: string;
  errorMessage: string;
  durationMs: number;
}

const RUNNER_PATH = path.join(__dirname, '..', 'runner', 'sandboxRunner.cjs');
// pnpm layout: the api package's own node_modules holds symlinks whose targets
// live under the repo-root node_modules/.pnpm — both must be readable.
const API_NODE_MODULES = path.resolve(__dirname, '../../../../node_modules');
const ROOT_NODE_MODULES = path.resolve(__dirname, '../../../../../../node_modules');

export const JUDGE_VERSION = '1';

export function runInSandbox(request: SandboxRequest): Promise<SandboxOutcome> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(
      process.execPath,
      [
        '--experimental-permission',
        `--allow-fs-read=${path.dirname(RUNNER_PATH)}`,
        `--allow-fs-read=${API_NODE_MODULES}`,
        `--allow-fs-read=${ROOT_NODE_MODULES}`,
        `--max-old-space-size=${request.memoryLimitMb}`,
        RUNNER_PATH,
      ],
      {
        env: {}, // no secrets, no PATH — nothing to exfiltrate
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    // Hard deadline: overall time limit + grace for process boot.
    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, request.timeLimitMs + 3000);
    killTimer.unref();

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < 200_000) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 20_000) stderr += chunk.toString('utf8');
    });

    const settle = (outcome: SandboxOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve(outcome);
    };

    child.on('error', (error) => {
      settle({
        status: 'ERROR',
        results: [],
        stdout: '',
        errorMessage: `Failed to start sandbox: ${error.message}`,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;

      if (signal === 'SIGKILL') {
        settle({
          status: 'TIMEOUT',
          results: [],
          stdout: '',
          errorMessage: 'Execution exceeded the time limit',
          durationMs,
        });
        return;
      }

      // The runner always writes exactly one JSON line on success paths.
      const lastLine = stdout.trim().split('\n').pop() ?? '';
      try {
        const parsed = JSON.parse(lastLine) as {
          ok: boolean;
          results?: SandboxTestResult[];
          stdout?: string;
          error?: string;
        };
        if (parsed.ok && Array.isArray(parsed.results)) {
          settle({
            status: 'COMPLETED',
            results: parsed.results,
            stdout: parsed.stdout ?? '',
            errorMessage: '',
            durationMs,
          });
          return;
        }
        settle({
          status: 'ERROR',
          results: [],
          stdout: parsed.stdout ?? '',
          errorMessage: parsed.error ?? 'Sandbox reported an error',
          durationMs,
        });
      } catch {
        // Crashed before reporting (e.g. OOM abort) — code is non-zero.
        settle({
          status: code === 0 ? 'ERROR' : 'ERROR',
          results: [],
          stdout: '',
          errorMessage:
            code !== 0
              ? `Sandbox exited abnormally (code ${code ?? 'null'}) — likely out of memory`
              : 'Sandbox produced no result',
          durationMs,
        });
      }
    });

    child.stdin.on('error', () => {
      /* EPIPE when the child dies early — the close handler settles */
    });
    child.stdin.end(
      JSON.stringify({
        environment: request.environment,
        files: request.files,
        tests: request.tests,
        timeLimitMs: request.timeLimitMs,
      }),
    );
  });
}
