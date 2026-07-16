# Testing Strategy

## Layers

| Layer          | Tool                           | Location                    | What it proves                                                                                                                                                                                         |
| -------------- | ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API use-cases  | Jest                           | `apps/api/src/**/__tests__` | Business rules against in-memory fakes of the ports — registration conflicts, credential checks, rotation, reuse detection, grace-window behaviour, logout idempotency. No DB, no network, sub-second. |
| Web components | Vitest + React Testing Library | `apps/web/src/**/__tests__` | User-visible behaviour of components (form validation, API error surfacing, success callbacks) with the API module mocked.                                                                             |
| End-to-end     | Playwright                     | `e2e/tests`                 | The real stack (Vite ⇄ Express ⇄ Postgres/Redis): register → dashboard → reload (silent refresh) → logout → login, wrong-credential errors, password policy.                                           |

## Principles

- **Test through the ports.** Use-cases are tested with hand-written in-memory fakes (`fakes.ts`), not mocking libraries — fakes keep invariants (e.g. rotation stamps) honest and readable.
- **Deterministic time.** `MutableClock` is injected everywhere time matters; expiry and grace-window tests advance it explicitly.
- **No trusted client.** E2E asserts server behaviour through the UI; unit tests assert error _codes_, not messages (messages are i18n concerns).
- **Repeatable E2E.** Each run registers unique emails, so the suite can run repeatedly against one database.

## Running

```bash
pnpm test                      # jest (api) + vitest (web) via turbo
pnpm --filter @academy/api test
pnpm --filter @academy/web test
docker compose up -d && pnpm e2e   # playwright (starts both dev servers)
```

CI runs lint, typecheck, unit/component tests and build on every push/PR, plus the Playwright suite against real Postgres/Redis service containers.
