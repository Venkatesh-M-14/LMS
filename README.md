# Frontend Engineering Academy

An interactive learning platform that takes students from zero programming knowledge to industry-ready frontend engineers — guided lessons, hands-on coding challenges, debugging labs, projects, adaptive learning, and an AI mentor in one integrated path.

## Monorepo layout

| Path                     | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `apps/web`               | Student/Instructor/Admin web app — React 19, Vite, MUI, React Router, Redux Toolkit, TanStack Query |
| `apps/api`               | REST + realtime API — Express 5, Clean Architecture, Prisma/PostgreSQL, Redis, Socket.IO            |
| `packages/shared`        | Zod schemas and API contract types shared by web and api                                            |
| `packages/tsconfig`      | Shared TypeScript configs                                                                           |
| `packages/eslint-config` | Shared ESLint flat config                                                                           |

## Getting started

Prerequisites: Node ≥ 20.19, pnpm ≥ 10, Docker.

```bash
pnpm install
docker compose up -d              # Postgres, Redis, Mailpit
cp .env.example apps/api/.env     # then set JWT_ACCESS_SECRET (openssl rand -hex 32)
pnpm db:migrate                   # apply Prisma migrations
pnpm dev                          # api on :4000, web on :5173
```

Open http://localhost:5173, register an account, and you land on the dashboard.

## Scripts

| Command                        | What it does                                                |
| ------------------------------ | ----------------------------------------------------------- |
| `pnpm dev`                     | Run api + web in watch mode (Turborepo)                     |
| `pnpm build`                   | Build all packages and apps                                 |
| `pnpm lint` / `pnpm typecheck` | Static checks across the workspace                          |
| `pnpm test`                    | Unit/component tests (Jest on api, Vitest+RTL on web)       |
| `pnpm e2e`                     | Playwright end-to-end suite (needs docker services running) |
| `pnpm db:migrate`              | Create/apply dev migrations                                 |

## Architecture

- **API** follows Clean Architecture per feature module (`domain` / `application` / `infrastructure` / `http`) with manual constructor injection composed in `src/container.ts`. Cross-module effects flow through a typed in-process event bus.
- **Auth**: argon2id password hashing, 15-minute JWT access tokens, 30-day opaque refresh tokens (hashed at rest) with rotation families and reuse detection, delivered via httpOnly cookie with double-submit CSRF protection.
- **Contracts**: every request/response is a Zod schema in `packages/shared` — the same schema validates at the API boundary and types the web client.

Full design docs live in [`docs/`](docs/).
