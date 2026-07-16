import type { FrozenTest } from '@academy/shared';
import { runInSandbox } from '../subprocessSandbox';

/**
 * Abuse-hardening tests — these spawn the REAL sandbox runner. This is the
 * milestone's acceptance gate: the judge must survive hostile code.
 */

jest.setTimeout(30_000);

const test1 = (spec: string, overrides: Partial<FrozenTest> = {}): FrozenTest => ({
  id: 't1',
  name: 'test 1',
  kind: 'UNIT',
  specCode: spec,
  weight: 1,
  isHidden: false,
  timeoutMs: 2000,
  ...overrides,
});

const run = (
  files: Record<string, string>,
  tests: FrozenTest[],
  environment: 'JS' | 'DOM' = 'JS',
) => runInSandbox({ environment, files, tests, timeLimitMs: 5000, memoryLimitMb: 128 });

describe('sandbox — honest code', () => {
  it('passes correct solutions and captures console output', async () => {
    const outcome = await run(
      { 'main.js': 'function add(a, b) { console.log("adding", a, b); return a + b; }' },
      [
        test1('assertEqual(add(2, 3), 5)'),
        test1('assert(add(-1, 1) === 0, "should handle negatives")', { id: 't2', name: 'test 2' }),
      ],
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results.map((r) => r.passed)).toEqual([true, true]);
    expect(outcome.stdout).toContain('adding 2 3');
  });

  it('fails wrong solutions with the assertion message', async () => {
    const outcome = await run({ 'main.js': 'function add(a, b) { return a - b; }' }, [
      test1('assertEqual(add(2, 3), 5)'),
    ]);
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results[0]?.passed).toBe(false);
    expect(outcome.results[0]?.message).toContain('Expected 5');
  });

  it('reports runtime errors in student code as an error outcome', async () => {
    const outcome = await run({ 'main.js': 'undefinedFunction();' }, [test1('assert(true)')]);
    expect(outcome.status).toBe('ERROR');
    expect(outcome.errorMessage.toLowerCase()).toContain('undefinedfunction');
  });

  it('runs DOM challenges against a jsdom document', async () => {
    const outcome = await run(
      {
        'main.js': `
          const list = document.createElement('ul');
          list.id = 'todos';
          for (const label of ['learn', 'build', 'ship']) {
            const li = document.createElement('li');
            li.textContent = label;
            list.appendChild(li);
          }
          document.body.appendChild(list);
        `,
      },
      [
        test1('assertEqual(document.querySelectorAll("#todos li").length, 3)', { kind: 'DOM' }),
        test1('assert(document.querySelector("#todos li").textContent === "learn")', {
          id: 't2',
          name: 'first item',
          kind: 'DOM',
        }),
      ],
      'DOM',
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results.map((r) => r.passed)).toEqual([true, true]);
  });
});

describe('sandbox — hostile code', () => {
  it('kills an infinite loop in student code', async () => {
    const outcome = await run({ 'main.js': 'while (true) {}' }, [test1('assert(true)')]);
    // vm sync timeout fires first (ERROR); the parent SIGKILL is the backstop (TIMEOUT).
    expect(['ERROR', 'TIMEOUT']).toContain(outcome.status);
    expect(outcome.results).toHaveLength(0);
  });

  it('kills an infinite loop inside a test spec', async () => {
    const outcome = await run({ 'main.js': 'function f() { return 1; }' }, [
      test1('while (true) {}', { timeoutMs: 1000 }),
      test1('assert(f() === 1)', { id: 't2', name: 'still runs' }),
    ]);
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results[0]?.passed).toBe(false);
    expect(outcome.results[1]?.passed).toBe(true); // one bad test cannot poison the rest
  });

  it('survives an allocation bomb via the memory cap', async () => {
    const outcome = await run(
      { 'main.js': 'const hog = []; while (true) { hog.push(new Array(1e6).fill("x")); }' },
      [test1('assert(true)')],
    );
    expect(['ERROR', 'TIMEOUT']).toContain(outcome.status);
  });

  it('gives user code no fetch, no require, no process', async () => {
    const outcome = await run(
      {
        'main.js': `
          var fetchType = typeof fetch;
          var requireType = typeof require;
          var processType = typeof process;
        `,
      },
      [
        test1('assertEqual(fetchType, "undefined")', { name: 'no fetch' }),
        test1('assertEqual(requireType, "undefined")', { id: 't2', name: 'no require' }),
        test1('assertEqual(processType, "undefined")', { id: 't3', name: 'no process' }),
      ],
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results.every((r) => r.passed)).toBe(true);
  });

  it('network attempts fail even after a constructor-chain escape', async () => {
    // The classic vm breakout: reach the host realm via the Function
    // constructor. The child process itself has no fetch and no secrets.
    const outcome = await run(
      {
        'main.js': `
          var escaped = 'unknown';
          try {
            var hostGlobal = this.constructor.constructor('return globalThis')();
            escaped = typeof hostGlobal.fetch;
          } catch (e) {
            escaped = 'blocked:' + e.message.slice(0, 20);
          }
        `,
      },
      [test1('assert(escaped === "undefined" || escaped.indexOf("blocked") === 0, escaped)')],
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results[0]?.passed).toBe(true);
  });

  it('filesystem access is denied by the permission model', async () => {
    const outcome = await run(
      {
        'main.js': `
          var fsResult = 'unknown';
          try {
            var hostProcess = this.constructor.constructor('return globalThis.process')();
            if (!hostProcess) { fsResult = 'no-process'; }
            else {
              hostProcess.binding('fs');
              fsResult = 'fs-bound';
            }
          } catch (e) {
            fsResult = 'denied';
          }
        `,
      },
      [test1('assert(fsResult === "denied" || fsResult === "no-process", fsResult)')],
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results[0]?.passed).toBe(true);
  });

  it('leaks no environment secrets into the sandbox', async () => {
    const outcome = await run(
      {
        'main.js': `
          var envKeys = 'unreachable';
          try {
            var hostProcess = this.constructor.constructor('return globalThis.process')();
            envKeys = hostProcess ? Object.keys(hostProcess.env).join(',') : 'unreachable';
          } catch (e) { envKeys = 'unreachable'; }
        `,
      },
      [
        test1(
          'assert(envKeys === "unreachable" || envKeys.indexOf("DATABASE_URL") === -1, "env leaked: " + envKeys)',
        ),
      ],
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.results[0]?.passed).toBe(true);
  });
});
