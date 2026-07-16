import { Router, type RequestHandler } from 'express';
import { ingestAnalyticsRequestSchema } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import { validate } from '../../../core/http/validate';
import { requireRole } from '../../../core/http/authenticate';
import type { AnalyticsService } from '../application/analyticsService';

export interface AnalyticsRouterDeps {
  analytics: AnalyticsService;
  authenticate: RequestHandler;
}

export function buildAnalyticsRouter(deps: AnalyticsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  // Any authenticated user can emit their own client events (batched).
  router.post(
    '/events',
    validate({ body: ingestAnalyticsRequestSchema }),
    asyncHandler(async (req, res) => {
      const accepted = await deps.analytics.ingest(req.user!.id, req.body.events);
      ok(res, { accepted });
    }),
  );

  // Dashboards are instructor/admin only.
  router.get(
    '/dashboard',
    requireRole('INSTRUCTOR'),
    asyncHandler(async (req, res) => {
      const windowDays = Number.parseInt(String(req.query.windowDays ?? '14'), 10) || 14;
      ok(res, await deps.analytics.getDashboard(windowDays));
    }),
  );

  return router;
}
