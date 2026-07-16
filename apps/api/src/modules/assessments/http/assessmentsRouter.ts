import { Router, type RequestHandler } from 'express';
import { saveAnswersRequestSchema } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { created, noContent, ok } from '../../../core/http/respond';
import type { AttemptService } from '../application/attemptService';

export interface AssessmentsRouterDeps {
  attempts: AttemptService;
  authenticate: RequestHandler;
}

/** Student-facing quiz endpoints. */
export function buildAssessmentsRouter(deps: AssessmentsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/lessons/:lessonId/summary',
    asyncHandler(async (req, res) => {
      ok(res, await deps.attempts.getSummaryForLesson(req.params.lessonId as string, req.user!.id));
    }),
  );

  router.post(
    '/:assessmentId/attempts',
    asyncHandler(async (req, res) => {
      created(
        res,
        await deps.attempts.start(req.params.assessmentId as string, req.user!.id, req.user!.role),
      );
    }),
  );

  router.get(
    '/attempts/:attemptId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.attempts.getView(req.params.attemptId as string, req.user!.id));
    }),
  );

  router.put(
    '/attempts/:attemptId/answers',
    validate({ body: saveAnswersRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.attempts.saveAnswers(
        req.params.attemptId as string,
        req.user!.id,
        req.body.answers,
      );
      noContent(res);
    }),
  );

  router.post(
    '/attempts/:attemptId/submit',
    validate({ body: saveAnswersRequestSchema.partial() }),
    asyncHandler(async (req, res) => {
      ok(
        res,
        await deps.attempts.submit(
          req.params.attemptId as string,
          req.user!.id,
          req.body.answers ?? {},
        ),
      );
    }),
  );

  return router;
}
