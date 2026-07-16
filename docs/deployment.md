# Deployment

A production checklist for the Frontend Engineering Academy. The stack is a
stateless Express API, a static web bundle, PostgreSQL, and Redis; BullMQ
workers (judge, email) run in-process with the API today and can be split out
later without code changes.

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
