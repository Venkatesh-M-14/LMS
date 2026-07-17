# Production image for the Academy API (works on amd64 and arm64 — including
# Oracle Cloud's free Ampere A1 VMs). Built from the repository ROOT:
#
#   docker build -f apps/api/Dockerfile -t academy-api .
#
# The container runs migrations on boot, then starts the server (which hosts
# the Socket.IO hub and the judge + email workers in-process).
FROM node:20-bookworm-slim

# Prisma engines need OpenSSL; the judge sandbox spawns `node` subprocesses
# (present by definition). Everything else is pure JS or ships prebuilds.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Install with a warm layer cache: manifests first, then source.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @academy/api... --filter @academy/shared...

COPY packages ./packages
COPY apps/api ./apps/api

# Build shared (types + runtime) and the API (tsc + sandbox runner copy),
# then generate the Prisma client for this platform.
RUN pnpm --filter @academy/shared build \
  && pnpm --filter @academy/api db:generate \
  && pnpm --filter @academy/api build

ENV NODE_ENV=production
EXPOSE 4000

WORKDIR /app/apps/api
# Apply any pending migrations, then serve. Seeding stays a manual step
# (`docker compose exec api pnpm db:seed`) so it can't surprise anyone.
CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/server.js"]
