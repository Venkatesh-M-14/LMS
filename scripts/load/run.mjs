#!/usr/bin/env node
/**
 * Load tests for the two hottest read/write paths (M9 hardening):
 *   - GET  /api/v1/gamification/leaderboard  (Redis ZSET read index)
 *   - POST /api/v1/analytics/events          (append-only batch ingest)
 *
 * Usage:
 *   node scripts/load/run.mjs [leaderboard|analytics|all] [--duration 10] [--connections 50]
 *
 * Requires the API running (default http://localhost:4000) and the seeded
 * student account. Prints latency percentiles + throughput per target.
 */
import autocannon from 'autocannon';

const API = process.env.API_ORIGIN ?? 'http://localhost:4000';
const EMAIL = process.env.LOAD_EMAIL ?? 'student@academy.local';
const PASSWORD = process.env.LOAD_PASSWORD ?? 'Academy-dev1';

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith('--')) ?? 'all';
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const duration = flag('duration', 10);
const connections = flag('connections', 50);

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) — is the API seeded?`);
  return (await res.json()).data.accessToken;
}

function run(title, opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({ duration, connections, ...opts }, (err, result) => {
      if (err) return reject(err);
      console.log(`\n=== ${title} ===`);
      console.log(`req/sec   avg ${result.requests.average.toFixed(0)}  (p97.5 latency ${result.latency.p97_5}ms)`);
      console.log(`latency   p50 ${result.latency.p50}ms  p99 ${result.latency.p99}ms  max ${result.latency.max}ms`);
      console.log(`non-2xx   ${result.non2xx}   errors ${result.errors}   total ${result.requests.total}`);
      resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: false });
  });
}

const token = await login();
const auth = { authorization: `Bearer ${token}` };

if (which === 'leaderboard' || which === 'all') {
  await run('GET /gamification/leaderboard', {
    url: `${API}/api/v1/gamification/leaderboard`,
    headers: auth,
  });
}

if (which === 'analytics' || which === 'all') {
  await run('POST /analytics/events', {
    url: `${API}/api/v1/analytics/events`,
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      events: [
        { name: 'page.view', props: { path: '/' } },
        { name: 'lesson.opened', props: { lessonId: 'load-test' } },
      ],
    }),
  });
}

console.log('\nDone.');
