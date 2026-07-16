# API Reference — Milestone 1

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

## Operational

- `GET /health` → 200 `{ data: { status: "ok", uptimeSec } }` (liveness)
- `GET /ready` → 200/503 `{ data: { status, checks: { database, redis } } }` (readiness)
