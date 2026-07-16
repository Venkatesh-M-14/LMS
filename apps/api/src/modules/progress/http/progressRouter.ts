import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import type { ProgressService } from '../application/progressService';

export interface ProgressRouterDeps {
  progress: ProgressService;
  authenticate: RequestHandler;
}

export function buildProgressRouter(deps: ProgressRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/map',
    asyncHandler(async (req, res) => {
      ok(res, await deps.progress.getMap(req.user!));
    }),
  );

  router.post(
    '/lessons/:lessonId/complete',
    asyncHandler(async (req, res) => {
      ok(res, await deps.progress.markLessonComplete(req.user!, req.params.lessonId as string));
    }),
  );

  return router;
}
