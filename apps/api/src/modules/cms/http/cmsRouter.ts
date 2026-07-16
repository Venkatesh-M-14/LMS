import { Router, type RequestHandler } from 'express';
import {
  createDraftRequestSchema,
  createLessonRequestSchema,
  rejectVersionRequestSchema,
  replaceBlocksRequestSchema,
  updateLessonSkillsRequestSchema,
} from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { created, noContent, ok } from '../../../core/http/respond';
import { requireRole } from '../../../core/http/authenticate';
import type { LessonAuthoringService } from '../application/lessonAuthoringService';
import type { Actor } from '../domain/workflow';

export interface CmsRouterDeps {
  authoring: LessonAuthoringService;
  authenticate: RequestHandler;
}

/** All CMS endpoints require the INSTRUCTOR role (admins pass every gate). */
export function buildCmsRouter(deps: CmsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, requireRole('INSTRUCTOR'));

  const actor = (req: { user?: { id: string; role: string } }): Actor => req.user as Actor;

  router.get(
    '/lessons',
    asyncHandler(async (_req, res) => {
      ok(res, await deps.authoring.listLessons());
    }),
  );

  router.get(
    '/skills',
    asyncHandler(async (_req, res) => {
      ok(res, await deps.authoring.listSkills());
    }),
  );

  router.post(
    '/lessons',
    validate({ body: createLessonRequestSchema }),
    asyncHandler(async (req, res) => {
      created(res, await deps.authoring.createLesson(req.body, actor(req)));
    }),
  );

  router.put(
    '/lessons/:lessonId/skills',
    validate({ body: updateLessonSkillsRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.authoring.setLessonSkills(req.params.lessonId as string, req.body.skillIds);
      noContent(res);
    }),
  );

  router.get(
    '/lessons/:lessonId/versions',
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.listVersions(req.params.lessonId as string));
    }),
  );

  router.post(
    '/lessons/:lessonId/versions',
    validate({ body: createDraftRequestSchema }),
    asyncHandler(async (req, res) => {
      created(
        res,
        await deps.authoring.createDraft(
          req.params.lessonId as string,
          req.body.changelog,
          actor(req),
        ),
      );
    }),
  );

  router.get(
    '/lesson-versions/:versionId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.getVersion(req.params.versionId as string));
    }),
  );

  router.put(
    '/lesson-versions/:versionId/blocks',
    validate({ body: replaceBlocksRequestSchema }),
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.replaceBlocks(req.params.versionId as string, req.body));
    }),
  );

  router.post(
    '/lesson-versions/:versionId/submit',
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.submit(req.params.versionId as string));
    }),
  );

  router.post(
    '/lesson-versions/:versionId/publish',
    asyncHandler(async (req, res) => {
      ok(res, await deps.authoring.publish(req.params.versionId as string, actor(req)));
    }),
  );

  router.post(
    '/lesson-versions/:versionId/reject',
    validate({ body: rejectVersionRequestSchema }),
    asyncHandler(async (req, res) => {
      ok(
        res,
        await deps.authoring.reject(
          req.params.versionId as string,
          req.body.reviewNotes,
          actor(req),
        ),
      );
    }),
  );

  return router;
}
