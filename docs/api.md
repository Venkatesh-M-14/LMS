# API Reference — Milestones 1–6

Base URL: `/api/v1` · All bodies are JSON (camelCase).

## Conventions

- **Success envelope**: `{ "data": …, "meta": … }` (meta only where documented)
- **Error envelope**: `{ "error": { "code", "message", "details"?, "requestId" } }`
- Clients must switch on `error.code`, never on messages. Current catalog:
  `VALIDATION_FAILED · NOT_FOUND · CONFLICT · INTERNAL · RATE_LIMITED · UNAUTHORIZED · FORBIDDEN · INVALID_CREDENTIALS · EMAIL_ALREADY_REGISTERED · REFRESH_TOKEN_INVALID · REFRESH_TOKEN_REUSED · CSRF_TOKEN_MISMATCH · ACCOUNT_SUSPENDED`
- Rate limit headers follow RFC draft-8 (`RateLimit-*`); auth endpoints allow 30 requests / 15 min / IP.

## Auth

Session delivery (register, login, refresh): the response body carries the access token; two cookies are set —
`academy_refresh` (httpOnly, SameSite=Strict, path=/api/v1/auth) and `academy_csrf` (readable, echoed as `X-CSRF-Token`).

### POST /auth/register → 201

```jsonc
// request
{ "email": "a@b.com", "password": "min 10 chars, letter+digit", "displayName": "Ada" }
// response data
{ "user": { "id", "email", "displayName", "role", "avatarUrl", "locale", "timezone", "createdAt" },
  "accessToken": "…", "accessTokenExpiresAt": 1789000000 }
```

Errors: `VALIDATION_FAILED` 400 · `EMAIL_ALREADY_REGISTERED` 409

### POST /auth/login → 200

Request `{ email, password }`; response identical to register.
Errors: `INVALID_CREDENTIALS` 401 · `ACCOUNT_SUSPENDED` 403

### POST /auth/refresh → 200

No body. Requires the `academy_refresh` cookie **and** `X-CSRF-Token` header matching the `academy_csrf` cookie. Rotates the refresh token; response identical to login.
Errors: `CSRF_TOKEN_MISMATCH` 403 · `REFRESH_TOKEN_INVALID` 401 · `REFRESH_TOKEN_REUSED` 401 (family revoked)

### POST /auth/logout → 204

Requires CSRF header. Revokes the token family and clears both cookies. Idempotent.

## Users

### GET /users/me → 200 _(Bearer token)_

Returns the authenticated user's DTO. Errors: `UNAUTHORIZED` 401 · `NOT_FOUND` 404

### GET /users?page=1&pageSize=20 → 200 _(Bearer token, ADMIN only)_

`data`: array of user DTOs · `meta`: `{ page, pageSize, total }`
Errors: `UNAUTHORIZED` 401 · `FORBIDDEN` 403 (non-admin)

## Curriculum _(Bearer token)_

### GET /curriculum/path → 200

The active path as a tree: `{ id, slug, title, description, modules[] }` → modules `{ …, topics[] }` → topics `{ …, depth: AUTHORED|OUTLINE, lessons[] }` → lessons `{ id, slug, title, order, estimatedMinutes, isPublished }`. Draft-only lessons appear with `isPublished: false`; students should not link to them.

### GET /curriculum/lessons/:lessonId → 200

Published content only, pinned to a version: `{ lessonId, versionId, versionNumber, title, topic, module, skills[], blocks[], publishedAt }`. Blocks: `{ id, order, type, payload, payloadSchemaVersion }`.
Errors: `NOT_FOUND` 404 · `LESSON_NOT_PUBLISHED` 404

## CMS _(Bearer token, INSTRUCTOR or ADMIN)_

| Endpoint                                | Purpose                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /cms/lessons`                      | All lessons with topic/module, skills, published version, latest version             |
| `POST /cms/lessons`                     | Create lesson (+ empty v1 draft). Body: `{ topicId, slug, title, estimatedMinutes }` |
| `PUT /cms/lessons/:id/skills`           | Replace skill tags. Body: `{ skillIds[] }`                                           |
| `GET /cms/skills`                       | All skills                                                                           |
| `GET /cms/lessons/:id/versions`         | Version history (newest first)                                                       |
| `POST /cms/lessons/:id/versions`        | New draft (blocks copied from published). Body: `{ changelog? }`                     |
| `GET /cms/lesson-versions/:id`          | Version detail incl. blocks                                                          |
| `PUT /cms/lesson-versions/:id/blocks`   | Replace a draft's blocks atomically. Body: `{ blocks: [{type, payload}] }`           |
| `POST /cms/lesson-versions/:id/submit`  | DRAFT → IN_REVIEW                                                                    |
| `POST /cms/lesson-versions/:id/publish` | IN_REVIEW → PUBLISHED (archives previous, repoints lesson)                           |
| `POST /cms/lesson-versions/:id/reject`  | IN_REVIEW → DRAFT. Body: `{ reviewNotes }`                                           |

Workflow error codes: `VERSION_NOT_EDITABLE` 409 · `INVALID_STATUS_TRANSITION` 409 · `OPEN_DRAFT_EXISTS` 409 · `REVIEWER_CANNOT_BE_AUTHOR` 403 · `SKILLS_REQUIRED_TO_PUBLISH` 422 · `EMPTY_VERSION_CANNOT_ADVANCE` 422 · `CONFLICT` 409 (concurrent transition lost the race)

## Assessments _(Bearer token)_

| Endpoint                                     | Purpose                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /assessments/lessons/:lessonId/summary` | Quiz card data: settings, item count, caller's attempts, canStart/blockedReason (null if no takeable quiz) |
| `POST /assessments/:id/attempts` → 201       | Start (or resume) an attempt; response items are **sanitized** (no answer keys)                            |
| `GET /assessments/attempts/:id`              | In-progress: sanitized items + saved answers. Graded: full results with keys/explanations revealed         |
| `PUT /assessments/attempts/:id/answers`      | Autosave `{ answers: { [itemId]: answer } }` (validated per item type)                                     |
| `POST /assessments/attempts/:id/submit`      | Flushes final answers, auto-grades; reflections → status `GRADING`, else `GRADED` with `scorePct/passed`   |

Errors: `ATTEMPT_LIMIT_REACHED` 409 · `COOLDOWN_ACTIVE` 429 · `ATTEMPT_NOT_IN_PROGRESS` 409 · `NO_ITEMS_TO_ATTEMPT` 409 · `ANSWER_INVALID` 400 · `FORBIDDEN` 403 (not your attempt)

## CMS — quizzes & grading _(INSTRUCTOR or ADMIN)_

| Endpoint                                | Purpose                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /cms/lessons/:lessonId/assessment` | Authoring view (full payloads incl. answer keys) or null                                                   |
| `PUT /cms/lessons/:lessonId/assessment` | Upsert settings `{ title, passingScorePct, maxAttempts, cooldownMinutes, shuffleItems }`                   |
| `PUT /cms/assessments/:id/items`        | Replace items `{ items: [{ points, skillIds, item: {type, payload} }] }` — never affects existing attempts |
| `GET /cms/grading`                      | Attempts awaiting manual grading (oldest first)                                                            |
| `GET /cms/grading/:attemptId`           | Reflection submissions with student answers                                                                |
| `POST /cms/grading/submissions/:id`     | `{ score ≤ item points, feedback }`; grading the last reflection finalizes the attempt                     |

Errors: `SUBMISSION_NOT_PENDING` 409 · `SCORE_EXCEEDS_POINTS` 422

## Judge & coding items

- CODING/DEBUGGING items live inside quizzes; the in-progress payload carries `starterFiles`, `visibleTests` (spec included) and `hiddenTestCount` — hidden specs never leave the server, even after grading.
- Answers are `{ files: { "path": "content" } }` (≤5 files, ≤50 KB each).
- Submit puts the attempt in `GRADING` while the judge runs; results (`ItemResult.run`) carry per-test verdicts (hidden tests show name+verdict only), stdout, and status `PASSED | FAILED | TIMEOUT | ERROR`. Socket.IO emits `attempt:graded` to `user:<id>` rooms (JWT handshake via `auth.token`).
- `GET /cms/challenges` _(INSTRUCTOR)_ lists challenges for the quiz editor.

## Progress _(Bearer token)_

| Endpoint                              | Purpose                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /progress/map`                   | Effective statuses for every unit (`LOCKED/AVAILABLE/IN_PROGRESS/COMPLETED` + best scores), `nextLessonId`, lesson counts. Auto-enrolls students in the active path. |
| `POST /progress/lessons/:id/complete` | Manual completion — only for lessons **without** a quiz (`LESSON_HAS_QUIZ` 409 otherwise). Returns `{ lessonCompleted, topicCompleted, moduleCompleted }`.           |

Gating errors elsewhere: `GET /curriculum/lessons/:id` and `POST /assessments/:id/attempts` return `GATING_LOCKED` 403 for students whose prerequisites are unmet (instructors/admins bypass).

## Projects _(Bearer token)_

| Endpoint                                  | Purpose                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /projects/briefs`                    | Brief summaries (which topics have projects)                                                                      |
| `GET /projects/topics/:topicId`           | Brief + rubric + the caller's submission (gated: `GATING_LOCKED` 403 on locked topics)                            |
| `POST /projects/briefs/:id/submit` → 201  | Submit `{ repoUrl, demoUrl?, notes? }`; resubmit allowed only from CHANGES_REQUESTED (`RESUBMIT_NOT_ALLOWED` 409) |
| `POST /projects/submissions/:id/messages` | Add to the feedback thread (owner only)                                                                           |

## CMS — project reviews _(INSTRUCTOR or ADMIN)_

| Endpoint                                 | Purpose                                                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /cms/projects`                      | Queue: PENDING + IN_REVIEW submissions, oldest first                                                                                                       |
| `GET /cms/projects/:id`                  | Full review detail (submission, brief, rubric, thread)                                                                                                     |
| `POST /cms/projects/:id/start-review`    | PENDING → IN_REVIEW                                                                                                                                        |
| `POST /cms/projects/:id/request-changes` | IN_REVIEW → CHANGES_REQUESTED (`{ message }` required, lands in the thread)                                                                                |
| `POST /cms/projects/:id/approve`         | IN_REVIEW → APPROVED with `{ scores: [{criterionId, points, comment?}] }` — every criterion, within max (`RUBRIC_INCOMPLETE` / `RUBRIC_SCORE_INVALID` 422) |
| `POST /cms/projects/:id/messages`        | Reviewer thread message                                                                                                                                    |

## Operational

- `GET /health` → 200 `{ data: { status: "ok", uptimeSec } }` (liveness)
- `GET /ready` → 200/503 `{ data: { status, checks: { database, redis } } }` (readiness)
