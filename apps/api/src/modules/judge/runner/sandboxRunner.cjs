'use strict';
/**
 * Sandbox runner — executes untrusted student code, one process per run.
 *
 * Layered containment (documented trade-off: process-level, not VM-level —
 * the JudgeService port allows swapping this lane for isolated-vm/gVisor
 * without redesign):
 *   1. Fresh child process per run: crash/OOM blast radius is this process.
 *   2. Spawned with a CLEAN env (no secrets) and Node's permission model:
 *      fs reads allowed only for the runner + node_modules, no fs writes,
 *      no child_process, no workers.
 *   3. Network globals (fetch/WebSocket) deleted before any user code runs.
 *   4. User code + tests execute inside a vm context with curated globals;
 *      helpers (console/assert) are defined IN-context so no host functions
 *      leak into user reach.
 *   5. Per-file and per-test sync timeouts via vm; the parent holds a hard
 *      SIGKILL timer; --max-old-space-size caps memory.
 *
 * Protocol: stdin JSON {environment, files, tests, timeLimitMs}
 *        → stdout single JSON line {ok, results, stdout, error?}.
 */

const vm = require('node:vm');

// (3) No network for anything that runs in this process from here on.
delete globalThis.fetch;
delete globalThis.WebSocket;
delete globalThis.EventSource;
delete globalThis.XMLHttpRequest;

const IN_CONTEXT_PRELUDE = `
'use strict';
globalThis.__logs = [];
globalThis.console = {
  log: (...a) => { if (__logs.length < 200) __logs.push(a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); } }).join(' ')); },
};
console.info = console.log; console.warn = console.log; console.error = console.log; console.debug = console.log;
globalThis.assert = function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
};
globalThis.assertEqual = function assertEqual(actual, expected, msg) {
  const ja = JSON.stringify(actual);
  const jb = JSON.stringify(expected);
  if (ja !== jb) throw new Error(msg || 'Expected ' + jb + ' but got ' + ja);
};
`;

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('input too large'));
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function buildContext(environment) {
  if (environment === 'DOM') {
    // jsdom is required lazily so pure JS runs never touch it.
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      runScripts: 'outside-only',
      url: 'https://sandbox.local/',
    });
    const context = dom.getInternalVMContext();
    vm.runInContext(IN_CONTEXT_PRELUDE, context);
    return context;
  }
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: true, wasm: false },
  });
  vm.runInContext(IN_CONTEXT_PRELUDE, context);
  return context;
}

function runScript(context, code, filename, timeoutMs) {
  const script = new vm.Script(code, { filename });
  script.runInContext(context, { timeout: timeoutMs });
}

async function main() {
  const input = JSON.parse(await readStdin());
  const { environment, files, tests, timeLimitMs } = input;

  const context = buildContext(environment);

  // Student code first — its declarations become context globals.
  for (const [path, content] of Object.entries(files)) {
    runScript(context, String(content), path, Math.min(timeLimitMs, 5000));
  }

  const results = [];
  for (const test of tests) {
    const startedAt = Date.now();
    try {
      runScript(context, test.specCode, `test:${test.name}`, test.timeoutMs);
      results.push({
        testId: test.id,
        name: test.name,
        passed: true,
        message: '',
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        testId: test.id,
        name: test.name,
        passed: false,
        message: String((error && error.message) || error).slice(0, 500),
        durationMs: Date.now() - startedAt,
      });
    }
  }

  let stdout = '';
  try {
    stdout = String(vm.runInContext('__logs.join("\\n")', context, { timeout: 1000 })).slice(0, 10_000);
  } catch {
    // console capture is best-effort
  }

  process.stdout.write(JSON.stringify({ ok: true, results, stdout }) + '\n');
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: String((error && error.message) || error).slice(0, 500) }) + '\n',
  );
  process.exit(0);
});
