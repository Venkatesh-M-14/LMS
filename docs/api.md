# API Reference — Milestones 1–2

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

| Endpoint | Purpose |
| --- | --- |
| `GET /cms/lessons` | All lessons with topic/module, skills, published version, latest version |
| `POST /cms/lessons` | Create lesson (+ empty v1 draft). Body: `{ topicId, slug, title, estimatedMinutes }` |
| `PUT /cms/lessons/:id/skills` | Replace skill tags. Body: `{ skillIds[] }` |
| `GET /cms/skills` | All skills |
| `GET /cms/lessons/:id/versions` | Version history (newest first) |
| `POST /cms/lessons/:id/versions` | New draft (blocks copied from published). Body: `{ changelog? }` |
| `GET /cms/lesson-versions/:id` | Version detail incl. blocks |
| `PUT /cms/lesson-versions/:id/blocks` | Replace a draft's blocks atomically. Body: `{ blocks: [{type, payload}] }` |
| `POST /cms/lesson-versions/:id/submit` | DRAFT → IN_REVIEW |
| `POST /cms/lesson-versions/:id/publish` | IN_REVIEW → PUBLISHED (archives previous, repoints lesson) |
| `POST /cms/lesson-versions/:id/reject` | IN_REVIEW → DRAFT. Body: `{ reviewNotes }` |

Workflow error codes: `VERSION_NOT_EDITABLE` 409 · `INVALID_STATUS_TRANSITION` 409 · `OPEN_DRAFT_EXISTS` 409 · `REVIEWER_CANNOT_BE_AUTHOR` 403 · `SKILLS_REQUIRED_TO_PUBLISH` 422 · `EMPTY_VERSION_CANNOT_ADVANCE` 422 · `CONFLICT` 409 (concurrent transition lost the race)

## Operational

- `GET /health` → 200 `{ data: { status: "ok", uptimeSec } }` (liveness)
- `GET /ready` → 200/503 `{ data: { status, checks: { database, redis } } }` (readiness)
