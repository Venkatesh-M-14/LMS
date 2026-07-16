import { Router, type RequestHandler } from 'express';
import {
  gradeSubmissionRequestSchema,
  replaceItemsRequestSchema,
  upsertAssessmentRequestSchema,
} from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { noContent, ok } from '../../../core/http/respond';
import { requireRole } from '../../../core/http/authenticate';
import type { AssessmentAuthoringService } from '../application/assessmentAuthoringService';
import type { GradingService } from '../application/gradingService';

export interface CmsAssessmentsRouterDeps {
  authoring: AssessmentAuthoringService;
  grading: GradingService;
  authenticate: RequestHandler;
}

/** Instructor-side assessment authoring + the manual grading queue. */
export function buildCmsAssessmentsRouter(deps: CmsAssessmentsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, requireRole('INSTRUCTOR'));

  router.get(
    '/lessons/:lessonId/assessment',
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.getForLesson(req.params.lessonId as string));
    }),
  );

  router.put(
    '/lessons/:lessonId/assessment',
    validate({ body: upsertAssessmentRequestSchema }),
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.upsertForLesson(req.params.lessonId as string, req.body));
    }),
  );

  router.put(
    '/assessments/:assessmentId/items',
    validate({ body: replaceItemsRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.authoring.replaceItems(req.params.assessmentId as string, req.body);
      noContent(res);
    }),
  );

  router.get(
    '/grading',
    asyncHandler(async (_req, res) => {
      ok(res, await deps.grading.listQueue());
    }),
  );

  router.get(
    '/grading/:attemptId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.grading.getDetail(req.params.attemptId as string));
    }),
  );

  router.post(
    '/grading/submissions/:submissionId',
    validate({ body: gradeSubmissionRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.grading.gradeSubmission(req.params.submissionId as string, req.user!.id, req.body);
      noContent(res);
    }),
  );

  return router;
}
