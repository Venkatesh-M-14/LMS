# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Browser
        WEB["React 19 SPA<br/>MUI · Redux Toolkit · TanStack Query"]
    end
    subgraph API["apps/api — Express 5"]
        HTTP[HTTP layer<br/>zod validation · envelopes]
        APP[Application layer<br/>use-cases]
        INFRA[Infrastructure layer<br/>Prisma repos · argon2 · JWT]
    end
    PG[(PostgreSQL)]
    RD[(Redis)]

    WEB -->|"/api/v1 (JSON + cookies)"| HTTP
    HTTP --> APP --> INFRA
    INFRA --> PG
    API --> RD
```

## Monorepo

| Package                                        | Role                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web`                                     | SPA served by Vite; consumes `@academy/shared` source via alias          |
| `apps/api`                                     | Express 5 API, CommonJS, Clean Architecture per module                   |
| `packages/shared`                              | Zod schemas + contract types; dual-emit (CJS for Node, ESM for bundlers) |
| `packages/tsconfig` / `packages/eslint-config` | Shared strict configs                                                    |

## API layering (per feature module)

```
modules/<feature>/
  domain/           pure invariants (grows with M2+)
  application/      use-cases + repository/service PORTS (interfaces)
  infrastructure/   Prisma/Redis/crypto ADAPTERS implementing the ports
  http/             router: zod validation → use-case → envelope
```

Rules:

- **Dependencies point inward.** `application` never imports express or prisma; `http` and `infrastructure` depend on `application`, never the reverse.
- **Composition happens once**, in `src/container.ts` (manual constructor injection — type-safe, no DI framework, the whole graph readable in one file).
- **Errors**: only `AppError` subclasses cross the HTTP boundary intentionally; the terminal middleware maps them to `{ error: { code, message, details?, requestId } }`. Unknown errors become opaque 500s.
- **Transactions** are opened in the application layer (`TransactionManager`); repositories never decide transaction boundaries. Multi-step repo operations that must be atomic (e.g. refresh-token rotation) expose a single aggregate method.

## Authentication design

- **Access token**: HS256 JWT, 15 min TTL, held in web app memory only (never storage).
- **Refresh token**: 48-byte opaque token, stored as SHA-256 hash, delivered via `httpOnly` + `SameSite=Strict` cookie scoped to `/api/v1/auth`.
- **Rotation families**: every login starts a family; each refresh creates a successor row and stamps the old row. Presenting an already-rotated token **outside** a 30 s grace window is treated as theft → the whole family is revoked. **Inside** the grace window (two tabs racing) a sibling token is issued instead.
- **CSRF**: double-submit — a non-httpOnly `academy_csrf` cookie must be echoed in `X-CSRF-Token` on refresh/logout; compared with a timing-safe equality check.
- **Password hashing**: argon2id (OWASP parameters). Unknown-email logins verify against a dummy hash so timing does not reveal account existence.
- **Rate limiting**: fixed-window Redis store; strict limits on `/auth/*` (30 per 15 min), a general API limit elsewhere.

## Frontend architecture

- **State split**: Redux Toolkit owns client state (session, UI preferences); TanStack Query owns server state (caching, retries). No server data is duplicated in Redux beyond the session snapshot.
- **Silent refresh**: the API client retries a 401 exactly once after a single-flight `/auth/refresh`; `SessionBootstrap` restores the session on first load, so protected routes never flash a redirect for a logged-in user.
- **Theming**: light/dark/system with the preference persisted via a Redux listener middleware.
- **i18n**: `i18next` with typed message catalogs (`ta` must satisfy `Messages` = shape of `en`, so missing keys fail typecheck).
- **Error handling**: a provider-independent root error boundary (no MUI/i18n/store dependencies — any of those could be the thing that crashed).

## Content model (M2)

Identity rows are stable — URLs, progress, and (from M4) gating point at them; content lives on versions:

```
Path ─▶ Module ─▶ Topic ─▶ Lesson ─▶ LessonVersion ─▶ ContentBlock
        (order)   (depth:            (status, author,   (order, type,
                   AUTHORED|OUTLINE)  reviewer)          JSON payload)
```

- **Version workflow**: `DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`. Rules live in one pure domain module ([workflow.ts](../apps/api/src/modules/cms/domain/workflow.ts)): drafts only are editable; empty versions cannot advance; **four-eyes** — the publisher must not be the author (admins exempt); publishing requires ≥1 skill tag; one open (draft/in-review) version per lesson.
- **One PUBLISHED version per lesson** is guaranteed three ways: application rule, transactional archive-then-publish, and a Postgres partial unique index (`WHERE status = 'PUBLISHED'`).
- **Immutable reads**: students read through `lesson.currentPublishedVersionId`; the response pins `versionId`, and a republish swaps the pointer atomically — it never mutates content someone already fetched.
- **Content blocks** are a typed JSON discriminated union (`MARKDOWN | CODE | CALLOUT | VIDEO | IMAGE | EMBED`) validated by shared Zod schemas on write _and_ re-validated on render (a malformed block degrades to a warning, never a crash). Each row carries `payloadSchemaVersion` for future migrations.
- **Skills** tag lessons now and assessment items later (M3) — they are the signal the adaptive-learning engine (M8) runs on, which is why publishing without tags is refused from day one.
- **Seed**: 9 modules / 31 topics / 35 skills; topics 1–2 fully authored (7 published lessons). Re-seeding never overwrites CMS work (content is only created for version-less lessons).

## Assessment engine (M3)

```
Assessment (per lesson: passing %, max attempts, cooldown, shuffle)
  └─ AssessmentItem (MCQ | MULTI_SELECT | OUTPUT_PREDICTION | REFLECTION,
                     points, JSON payload with answer keys, skill tags)
Attempt (per student: itemsSnapshot ❄, pinned lessonVersionId)
  └─ ItemSubmission (answer, autoScore, manualScore, graderFeedback)
```

- **Snapshots are the contract.** Starting an attempt freezes the full item payloads into `Attempt.itemsSnapshot`. Instructors can rewrite the quiz freely — in-flight and historical attempts grade against what the learner actually saw (tested explicitly).
- **Answer keys never leak.** The snapshot contains keys, so it never leaves the server raw: one sanctioned sanitizer (`toStudentPayload`) strips `correctOptionId(s)` / `expectedOutput` / `explanation` for in-progress views; keys are revealed only in graded results (a pending reflection stays sanitized).
- **All scoring lives in one pure module** ([grading.ts](../apps/api/src/modules/assessments/domain/grading.ts)): MCQ all-or-nothing; multi-select partial credit `(right − wrong) / total correct, floored at 0` — selecting everything earns nothing; output prediction with exact/trimmed/normalized matching; answered reflections park for manual grading, empty ones auto-zero.
- **Two-phase grading.** Submit auto-grades everything gradable. No reflections → `GRADED` immediately (score, pass/fail at the assessment's threshold). Otherwise `GRADING`: the attempt sits in the instructor queue; scoring the last reflection finalizes totals atomically.
- **Attempt admission** (resume-first, then max-attempts, then cooldown) is a pure policy function; limits and cooldowns are per-assessment settings.
- **Autosave + submit-flush**: the client debounces answer saves and also sends the full answer set with submit, so a lost autosave can't lose work.

## Coding playground & judge (M5)

Two-tier execution, exactly as designed:

- **Tier 1 — client, instant, advisory.** "Run visible tests" executes in the browser: JS in a throwaway Web Worker (hard 2 s terminate), DOM in a sandboxed opaque-origin `srcdoc` iframe with a postMessage protocol. Only non-hidden test specs ever reach the client; results are UI feedback, never grades.
- **Tier 2 — server, authoritative.** Submitting an attempt writes `ExecutionRun` intent rows, commits, then enqueues BullMQ jobs (a crashed enqueue leaves a recoverable QUEUED row, never a ghost job). The worker claims runs atomically (`QUEUED → RUNNING` guard), executes in the sandbox, scores by test weights, and the shared `AttemptFinalizer` closes the attempt when the last pending grade (judge or manual) lands. Socket.IO pushes `attempt:graded` to the user's room; the client also polls as a fallback.
- **Snapshot grading.** At attempt start the full challenge (instructions, starter files, ALL tests) is frozen into the attempt snapshot; the judge grades from the snapshot, so challenge edits never affect in-flight attempts. Solutions are never part of the freeze.
- **The sandbox** ([sandboxRunner.cjs](../apps/api/src/modules/judge/runner/sandboxRunner.cjs)) is one child process per run with layered containment: clean env (no secrets), Node permission model (fs reads limited to the runner + node_modules, no writes/child_process/workers), network globals deleted before user code runs, a curated `vm` context (in-context console/assert — no host functions in user reach), per-file/per-test sync timeouts, `--max-old-space-size` memory cap, and a parent SIGKILL deadline. **Documented trade-off:** process-level, not VM-level isolation — the `JudgeService` port allows swapping this lane for isolated-vm/gVisor without redesign. The abuse suite (infinite loops, allocation bombs, constructor-chain escapes, fs/network/env probes) runs against the real runner in CI.

## Projects & machine coding (M6)

- **Topic-level briefs** (`ProjectBrief`, MINI_PROJECT | MACHINE_CODING) with rubric definitions (`RubricCriterion`); submissions are repo + optional demo URLs (bundle upload arrives with object storage — deliberate deferral).
- **Review state machine** in one pure module ([reviewWorkflow.ts](../apps/api/src/modules/projects/domain/reviewWorkflow.ts)): `PENDING → IN_REVIEW → CHANGES_REQUESTED | APPROVED`; resubmission is allowed only from CHANGES_REQUESTED and resets to PENDING with an incremented round; transitions are guarded updates (concurrent reviewers cannot double-transition).
- **Rubric-scored approval**: every criterion must be scored exactly once within its max; the earned total is derived from the scores, never stored redundantly.
- **Feedback thread** per submission (`SubmissionMessage`) shared by student and reviewers — the review history survives resubmissions because the submission row is reused (round++) rather than replaced.
- **Gating applies**: project pages/submission are gated on topic accessibility (same evaluator as lessons); `ProjectApproved` is emitted on the event bus for gamification (M7).

## Gamification & certificates (M7)

- **XP is an append-only ledger.** `XpTransaction` has a unique `idempotencyKey` derived from `(reason, source)`; a retried or re-graded event inserts a duplicate that hits the constraint and no-ops. `UserStats` (XP, level, streak) is projected in the _same transaction_ as the ledger insert, so it can never drift from the ledger.
- **Timezone-correct streaks** ([streak.ts](../apps/api/src/modules/gamification/domain/streak.ts)): activity is compared as user-local calendar dates (`Intl.DateTimeFormat` with the user's IANA zone), never as 24-hour deltas — a DST day still counts as one day. Same day = no change, next day = +1, gap = reset to 1; longest streak is preserved.
- **Achievements** are pure predicates over aggregate progress; the engine re-evaluates after every XP event and grants newly-satisfied ones idempotently (composite key), awarding their bonus XP through the same ledger.
- **Leaderboard**: a Redis ZSET is the fast read index (`ZADD` on award, `ZREVRANGE`/`ZREVRANK` on read); Postgres `UserStats` is the source of truth and rebuilds the ZSET on a cold cache. The caller's own rank is always resolved, even outside the top slice.
- **Certificates** issue on module/path completion (checked from progress records, so issuance self-heals on the next event), idempotent on `(user, scope, scopeId)`. Each carries a serial and an unguessable `verificationCode`; a **public, unauthenticated** `/verify/:code` endpoint and page confirm authenticity. PDF export is the browser print dialog (a headless-render worker is a documented later add).
- **Wiring**: gamification subscribes to `AttemptGraded`, `ProjectApproved`, and the new `LessonCompleted` (quizless manual completion) on the in-process event bus — no direct dependency from the publishing modules.

## Progress & gating (M4)

- **Derived availability, persisted achievement.** Only `IN_PROGRESS`/`COMPLETED` are stored (`ProgressRecord`, polymorphic over lesson/topic/module). `LOCKED`/`AVAILABLE` are computed on every read from `PrerequisiteRule` + completions ([gating.ts](../apps/api/src/modules/progress/domain/gating.ts)) — there is no unlock state to corrupt or race.
- **Rules are data.** Defaults (strictly sequential lessons, topics, modules; optional `minScorePct`) are generated from curriculum order at seed time and live in a table admins can edit later.
- **Exactly-once completion.** `completeUnit` uses an atomic transition guard (`updateMany … WHERE status != COMPLETED`, unique row per user/unit): under concurrent quiz submissions only one caller performs each transition, while best scores take the maximum seen. The cascade lesson → topic → module runs on the `AttemptGraded` event (both immediate grading and the manual-grading finalize publish it via the typed in-process EventBus).
- **Server-side enforcement, twice.** Students hitting a locked lesson get `GATING_LOCKED` 403 on the content read _and_ on quiz attempt start; the UI's disabled rows are hints, never the mechanism. Instructors/admins bypass gating (they author and review).
- **Completion semantics.** A lesson with a quiz completes by passing it; a quizless lesson completes via an explicit mark-complete endpoint. Topics complete when all their _published_ lessons complete (outline topics never complete and never block); modules complete from their content-bearing topics.

## Decisions & trade-offs (M1)

| Decision                               | Rationale                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Express 5 + CommonJS                   | User choice; CJS keeps Jest/ts-jest friction-free. ESM-only deps are avoided or hand-rolled (Redis rate-limit store).                             |
| Jest (api) / Vitest (web)              | The spec lists Jest + RTL; RTL runs on Vitest natively in a Vite app — same assertions, no ESM/transform hacks. Jest stays where it is idiomatic. |
| Opaque refresh tokens (not JWT)        | Server-side revocation and reuse detection are hard requirements; opaque + hash gives both cheaply.                                               |
| Offset pagination for admin users list | Admin tables need jump-to-page; cursor pagination arrives with feeds (M7+).                                                                       |
