import { Router, type RequestHandler } from 'express';
import type { Role } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import type { CurriculumQueryService } from '../application/curriculumQueryService';

/** Gating port implemented by the progress module (wired in the container). */
export interface CurriculumGate {
  assertLessonAccessible(actor: { id: string; role: Role }, lessonId: string): Promise<void>;
  markLessonOpened(actor: { id: string; role: Role }, lessonId: string): Promise<void>;
}

export interface CurriculumRouterDeps {
  curriculum: CurriculumQueryService;
  gate: CurriculumGate;
  /** Adaptive hook: opening a lesson clears matching revision assignments. */
  onLessonOpened?: (userId: string, lessonId: string) => Promise<void>;
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
      const lessonId = req.params.lessonId as string;
      // Gate BEFORE reading: students only see published content they unlocked.
      await deps.gate.assertLessonAccessible(req.user!, lessonId);
      const lesson = await deps.curriculum.getLessonRead(lessonId);
      await deps.gate.markLessonOpened(req.user!, lessonId);
      if (deps.onLessonOpened) await deps.onLessonOpened(req.user!.id, lessonId);
      ok(res, lesson);
    }),
  );

  return router;
}
