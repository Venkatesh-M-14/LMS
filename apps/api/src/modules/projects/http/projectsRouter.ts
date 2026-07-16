import { Router, type RequestHandler } from 'express';
import {
  approveProjectRequestSchema,
  requestChangesRequestSchema,
  submissionMessageRequestSchema,
  submitProjectRequestSchema,
} from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { created, noContent, ok } from '../../../core/http/respond';
import { requireRole } from '../../../core/http/authenticate';
import type { ProjectService } from '../application/projectService';

export interface ProjectsRouterDeps {
  projects: ProjectService;
  authenticate: RequestHandler;
}

/** Student-facing project endpoints. */
export function buildProjectsRouter(deps: ProjectsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/briefs',
    asyncHandler(async (_req, res) => {
      ok(res, await deps.projects.listBriefSummaries());
    }),
  );

  router.get(
    '/topics/:topicId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.projects.getProjectForTopic(req.user!, req.params.topicId as string));
    }),
  );

  router.post(
    '/briefs/:briefId/submit',
    validate({ body: submitProjectRequestSchema }),
    asyncHandler(async (req, res) => {
      created(res, await deps.projects.submit(req.user!, req.params.briefId as string, req.body));
    }),
  );

  router.post(
    '/submissions/:submissionId/messages',
    validate({ body: submissionMessageRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.projects.addStudentMessage(
        req.user!,
        req.params.submissionId as string,
        req.body.body,
      );
      noContent(res);
    }),
  );

  return router;
}

/** Instructor review endpoints (mounted under /cms). */
export function buildCmsProjectsRouter(deps: ProjectsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, requireRole('INSTRUCTOR'));

  router.get(
    '/projects',
    asyncHandler(async (_req, res) => {
      ok(res, await deps.projects.listQueue());
    }),
  );

  router.get(
    '/projects/:submissionId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.projects.getReviewDetail(req.params.submissionId as string));
    }),
  );

  router.post(
    '/projects/:submissionId/start-review',
    asyncHandler(async (req, res) => {
      await deps.projects.startReview(req.user!, req.params.submissionId as string);
      noContent(res);
    }),
  );

  router.post(
    '/projects/:submissionId/request-changes',
    validate({ body: requestChangesRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.projects.requestChanges(
        req.user!,
        req.params.submissionId as string,
        req.body.message,
      );
      noContent(res);
    }),
  );

  router.post(
    '/projects/:submissionId/approve',
    validate({ body: approveProjectRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.projects.approve(req.user!, req.params.submissionId as string, req.body);
      noContent(res);
    }),
  );

  router.post(
    '/projects/:submissionId/messages',
    validate({ body: submissionMessageRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.projects.addReviewerMessage(
        req.user!,
        req.params.submissionId as string,
        req.body.body,
      );
      noContent(res);
    }),
  );

  return router;
}
