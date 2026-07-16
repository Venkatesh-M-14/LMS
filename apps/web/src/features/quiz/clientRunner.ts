/**
 * Client-side instant test runs — advisory feedback only; grading always
 * happens in the server sandbox. JS runs in a throwaway Web Worker (hard
 * 2s terminate); DOM runs in a sandboxed opaque-origin iframe.
 */

export interface ClientTest {
  id: string;
  name: string;
  specCode: string;
}

export interface ClientTestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

const PRELUDE = `
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(actual, expected, msg) {
  const ja = JSON.stringify(actual); const jb = JSON.stringify(expected);
  if (ja !== jb) throw new Error(msg || 'Expected ' + jb + ' but got ' + ja);
}
function __runTests(tests) {
  const results = [];
  for (const t of tests) {
    try {
      (0, eval)(t.specCode);
      results.push({ id: t.id, name: t.name, passed: true, message: '' });
    } catch (e) {
      results.push({ id: t.id, name: t.name, passed: false, message: String(e && e.message || e).slice(0, 300) });
    }
  }
  return results;
}
`;

const RUN_TIMEOUT_MS = 2000;

export function runJsTestsInWorker(
  files: Record<string, string>,
  tests: ClientTest[],
): Promise<ClientTestResult[]> {
  const userCode = Object.values(files).join('\n;\n');
  const source = `
    ${PRELUDE}
    self.onmessage = (event) => {
      try {
        (0, eval)(event.data.userCode);
        self.postMessage({ ok: true, results: __runTests(event.data.tests) });
      } catch (e) {
        self.postMessage({ ok: false, error: String(e && e.message || e).slice(0, 300) });
      }
    };
  `;
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(blobUrl);

  return new Promise((resolve) => {
    const finish = (results: ClientTestResult[]) => {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve(results);
    };
    const timer = setTimeout(() => {
      finish(
        tests.map((test) => ({
          id: test.id,
          name: test.name,
          passed: false,
          message: 'Timed out — check for infinite loops',
        })),
      );
    }, RUN_TIMEOUT_MS);

    worker.onmessage = (event) => {
      clearTimeout(timer);
      const data = event.data as { ok: boolean; results?: ClientTestResult[]; error?: string };
      if (data.ok && data.results) {
        finish(data.results);
      } else {
        finish(
          tests.map((test) => ({
            id: test.id,
            name: test.name,
            passed: false,
            message: data.error ?? 'Your code threw before the tests ran',
          })),
        );
      }
    };
    worker.postMessage({ userCode, tests });
  });
}

export function runDomTestsInIframe(
  files: Record<string, string>,
  tests: ClientTest[],
): Promise<ClientTestResult[]> {
  const userCode = Object.values(files).join('\n;\n');
  const nonce = Math.random().toString(36).slice(2);
  const html = `<!doctype html><html><body><script>
    ${PRELUDE}
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.nonce !== ${JSON.stringify(nonce)}) return;
      try {
        (0, eval)(event.data.userCode);
        parent.postMessage({ nonce: ${JSON.stringify(nonce)}, ok: true, results: __runTests(event.data.tests) }, '*');
      } catch (e) {
        parent.postMessage({ nonce: ${JSON.stringify(nonce)}, ok: false, error: String(e && e.message || e).slice(0, 300) }, '*');
      }
    });
    parent.postMessage({ nonce: ${JSON.stringify(nonce)}, ready: true }, '*');
  ${'</'}script></body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts'); // opaque origin: no cookies, no parent DOM
  iframe.style.display = 'none';
  iframe.srcdoc = html;

  return new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      iframe.remove();
    };
    const fail = (message: string) => {
      cleanup();
      resolve(tests.map((test) => ({ id: test.id, name: test.name, passed: false, message })));
    };
    const timer = setTimeout(
      () => fail('Timed out — check for infinite loops'),
      RUN_TIMEOUT_MS + 1000,
    );

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        nonce?: string;
        ready?: boolean;
        ok?: boolean;
        results?: ClientTestResult[];
        error?: string;
      };
      if (data?.nonce !== nonce) return;
      if (data.ready) {
        iframe.contentWindow?.postMessage({ nonce, userCode, tests }, '*');
        return;
      }
      clearTimeout(timer);
      if (data.ok && data.results) {
        cleanup();
        resolve(data.results);
      } else {
        fail(data.error ?? 'Your code threw before the tests ran');
      }
    };

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
  });
}

export function runClientTests(
  environment: 'JS' | 'DOM',
  files: Record<string, string>,
  tests: ClientTest[],
): Promise<ClientTestResult[]> {
  return environment === 'DOM'
    ? runDomTestsInIframe(files, tests)
    : runJsTestsInWorker(files, tests);
}
