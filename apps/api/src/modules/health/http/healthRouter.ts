import { Router } from 'express';
import type Redis from 'ioredis';
import type { PrismaClient } from '../../../core/db/prisma';
import { asyncHandler } from '../../../core/http/asyncHandler';

export interface HealthRouterDeps {
  prisma: PrismaClient;
  redis: Redis;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms).unref()),
  ]);
}

export function buildHealthRouter(deps: HealthRouterDeps): Router {
  const router = Router();

  // Liveness: the process is up and serving.
  router.get('/health', (_req, res) => {
    res.status(200).json({ data: { status: 'ok', uptimeSec: Math.round(process.uptime()) } });
  });

  // Readiness: dependencies are reachable — used by orchestrators/load balancers.
  router.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      const [db, redis] = await Promise.allSettled([
        withTimeout(deps.prisma.$queryRaw`SELECT 1`, 1500),
        withTimeout(deps.redis.ping(), 1500),
      ]);
      const ready = db.status === 'fulfilled' && redis.status === 'fulfilled';
      res.status(ready ? 200 : 503).json({
        data: {
          status: ready ? 'ready' : 'degraded',
          checks: {
            database: db.status === 'fulfilled' ? 'up' : 'down',
            redis: redis.status === 'fulfilled' ? 'up' : 'down',
          },
        },
      });
    }),
  );

  return router;
}
