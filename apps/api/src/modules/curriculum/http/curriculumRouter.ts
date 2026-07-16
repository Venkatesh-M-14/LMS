import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import type { CurriculumQueryService } from '../application/curriculumQueryService';

export interface CurriculumRouterDeps {
  curriculum: CurriculumQueryService;
  authenticate: RequestHandler;
}

export function buildCurriculumRouter(deps: CurriculumRouterDeps): Router {
  const router = Router();

  router.get(
    '/path',
    deps.authenticate,
    asyncHandler(async (_req, res) => {
      ok(res, await deps.curriculum.getPathTree());
    }),
  );

  router.get(
    '/lessons/:lessonId',
    deps.authenticate,
    asyncHandler(async (req, res) => {
      ok(res, await deps.curriculum.getLessonRead(req.params.lessonId as string));
    }),
  );

  return router;
}
