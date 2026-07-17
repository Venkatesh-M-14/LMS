# Deployment

> **Deploying for $0?** Follow the dedicated step-by-step guide:
> [deploy-tier0.md](./deploy-tier0.md) — Vercel + Oracle free VM + Neon,
> using the production Dockerfile and compose file in this repo.

A production checklist for the Frontend Engineering Academy. The stack is a
stateless Express API, a static web bundle, PostgreSQL, and Redis; BullMQ
workers (judge, email) run in-process with the API today and can be split out
later without code changes.

## Vercel (frontend) — and why the backend needs its own host

**Vercel hosts the web app only.** The API cannot run on Vercel: Vercel runs
short-lived serverless functions, while this API is a long-lived server that
holds **Socket.IO connections** (chat, notifications, judge results), runs
**BullMQ workers** (email drain, code judge), **spawns sandbox subprocesses**
to execute learner code, and needs persistent **PostgreSQL + Redis**. Host the
API on a always-on-process platform — **Railway**, **Render**, or **Fly.io**
are the easy options (all three also offer managed Postgres; use their Redis
or Upstash) — or any VPS with Docker.

### One-time setup

1. **Deploy the API first** (e.g. Railway): create a service from this repo
   with root `apps/api`, add Postgres + Redis, set the env vars from the table
   below (`pnpm db:migrate:deploy && pnpm db:seed` on first boot — set
   `SEED_PASSWORD` so the seeded admin/instructor don't get the dev default).
   Note the public URL, e.g. `https://academy-api.up.railway.app`.
2. **Point the web at it**: in [apps/web/vercel.json](../apps/web/vercel.json),
   replace both `YOUR-API-DOMAIN` placeholders with that API host.
3. **Import the repo in Vercel** (vercel.com → Add New → Project):
   - **Root Directory:** `apps/web` (enable “Include files outside root”)
   - Install/build/output are read from `vercel.json` (pnpm + turbo; builds
     `@academy/shared` first, outputs `dist/`). No env vars are needed on the
     web side.
4. **Set the API's `WEB_ORIGIN`** to your Vercel URL (e.g.
   `https://academy.vercel.app`).

### How it fits together

The web app calls `/api/v1/...` and `/socket.io` on its **own origin**;
`vercel.json` rewrites proxy those to the API. That keeps everything
same-origin, so the auth cookies and CSRF double-submit work unchanged, and no
CORS is involved. (WebSocket upgrades don't pass through Vercel rewrites —
Socket.IO detects this and falls back to HTTP long-polling automatically,
which is fine at small-circle scale.) All other routes rewrite to
`index.html` for the SPA, with static assets served first.

### CI/CD

- **Frontend:** Vercel's Git integration deploys every push to `main` and
  gives each PR a preview URL — that *is* the CD. The existing GitHub Actions
  workflow stays as the test gate (lint, typecheck, unit, E2E) on every push.
- **Backend:** Railway/Render/Fly all auto-deploy from GitHub the same way —
  point the service at `main`, and apply migrations on deploy
  (`pnpm db:migrate:deploy` as the release/pre-deploy command).

## Launch checklist (fresh community)

- `pnpm --filter @academy/api reset:community` wipes all users (except
  `KEEP_EMAILS`, default admin + instructor), chats, notifications, analytics,
  attempts, XP and E2E-authored junk lessons — the curriculum, quizzes,
  challenges and rules stay. Run it against prod once before inviting people.
- `pnpm --filter @academy/api set:password <email> '<new password>'` changes
  any account's password and logs it out everywhere — set a strong admin
  password before going live (or seed with `SEED_PASSWORD` set).
- Seeded logins (password `Academy-dev1` unless `SEED_PASSWORD` was set):
  `admin@academy.local` (ADMIN), `instructor@academy.local` (INSTRUCTOR).
  The `student@academy.local` demo account is not kept by the reset; your
  members register their own accounts.

## Topology

```
            ┌────────────┐      ┌──────────────┐
  Browser ──│  CDN / web │      │  API (Node)  │── PostgreSQL
   (PWA)    │  (static)  │──/api│  Express +   │── Redis (rate limit, leaderboard,
            └────────────┘  ⇄ws │  Socket.IO + │            BullMQ queues, sockets)
                                │  workers     │── SMTP relay
                                └──────────────┘
```

- **Web** is a static build (`apps/web/dist`) served by any CDN/static host. It
  talks to the API at `/api` (same origin in dev via the Vite proxy; in prod put
  web and API behind one hostname, or set the API's `WEB_ORIGIN`/CORS allowlist).
- **API** is horizontally scalable behind a load balancer. Redis is shared state
  (rate-limit counters, leaderboard ZSET, BullMQ, socket rooms via the adapter);
  Postgres is the source of truth.
- **Workers**: the judge and email drains run inside the API process. To scale
  them out, run the same image with a worker entrypoint against the same Redis.

## Build & release

```bash
pnpm install --frozen-lockfile
pnpm --filter @academy/shared build
pnpm --filter @academy/api db:generate
pnpm db:migrate:deploy          # apply migrations (no prompts)
pnpm build                      # builds shared, api, web
pnpm --filter @academy/api db:seed   # first deploy only (idempotent upserts)
```

Serve `apps/web/dist` statically and run the API with `node apps/api/dist/server.js`.

## Environment

Copy `.env.example` and set real values. Required in production:

| Variable                       | Notes                                                       |
| ------------------------------ | ----------------------------------------------------------- |
| `NODE_ENV=production`          | Enables secure cookies, disables the OpenAPI/Scalar docs UI |
| `DATABASE_URL`                 | Postgres connection string                                  |
| `REDIS_URL`                    | Redis connection string                                     |
| `JWT_ACCESS_SECRET`            | ≥ 32 chars — `openssl rand -hex 32`                         |
| `API_ORIGIN`, `WEB_ORIGIN`     | Public URLs; `WEB_ORIGIN` gates CORS + Socket.IO            |
| `ANTHROPIC_API_KEY`            | For the AI Mentor; omit → mentor reports "not configured"   |
| `MENTOR_PROVIDER=anthropic`    | Use `fake` only in dev/CI                                   |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Email relay; omit `SMTP_HOST` → emails are marked SENT without sending |
| `EMAIL_FROM`                   | From address for outbound mail                              |
| `RATE_LIMIT_*`                 | Tune per traffic; defaults are conservative                 |

## Migrations & data

- Migrations are forward-only and applied with `prisma migrate deploy` (never
  `migrate dev` in prod). Two indexes are hand-written in migrations: the
  one-published-version-per-lesson partial unique index, and the BRIN index on
  `analytics_events.occurredAt`.
- The seed is idempotent (upserts) and safe to re-run; it provisions the
  curriculum, quizzes, challenges, gating rules, and the dev accounts.

## Operational

- **Health/readiness**: `GET /health` (liveness), `GET /ready` (checks Postgres
  + Redis) — wire the latter to your orchestrator's readiness probe.
- **Graceful shutdown**: on `SIGTERM` the server stops accepting connections,
  drains the judge + email workers, then disconnects Postgres/Redis.
- **Email outbox recovery**: on boot the API re-enqueues any `PENDING`/`SENDING`
  rows, so a crash mid-send never loses a message.
- **Service worker**: the web build ships a Workbox SW (`sw.js`) with
  `autoUpdate`; clients are prompted to reload on a new version. Lessons are
  cached for offline reading; `/api/v1/assessments/*` is network-only so grading
  never runs against stale data.
- **Analytics volume**: `analytics_events` is append-only and grows fast. The
  BRIN index keeps writes cheap; add a retention job (drop partitions or delete
  by `occurredAt`) when volume warrants.

## Scaling notes

- Multiple API instances need the Redis Socket.IO adapter for cross-node pushes
  (single node works out of the box).
- The judge runs learner code in short-lived subprocesses; give worker nodes CPU
  headroom and keep `JUDGE_CONCURRENCY` matched to cores. The `JudgeService` port
  allows moving the DOM lane to a stronger sandbox (gVisor/Firecracker) later.
- Load-test the leaderboard and analytics-ingest paths with `pnpm load` before a
  launch; both sustain ~2,200 req/s at p99 < 30 ms per API node on commodity
  hardware.
