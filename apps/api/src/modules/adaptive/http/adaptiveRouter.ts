import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import type { AdaptiveService } from '../application/adaptiveService';

export interface AdaptiveRouterDeps {
  adaptive: AdaptiveService;
  authenticate: RequestHandler;
}

export function buildAdaptiveRouter(deps: AdaptiveRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/revisions',
    asyncHandler(async (req, res) => {
      ok(res, await deps.adaptive.listAssignments(req.user!.id));
    }),
  );

  return router;
}
