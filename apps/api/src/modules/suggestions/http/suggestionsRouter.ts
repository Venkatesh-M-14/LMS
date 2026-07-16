import { Router, type RequestHandler } from 'express';
import {
  createSuggestionRequestSchema,
  reviewSuggestionRequestSchema,
  type SuggestionStatus,
} from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { created, noContent, ok } from '../../../core/http/respond';
import { validate } from '../../../core/http/validate';
import { requireRole } from '../../../core/http/authenticate';
import type { SuggestionService } from '../application/suggestionService';

export interface SuggestionsRouterDeps {
  suggestions: SuggestionService;
  authenticate: RequestHandler;
}

/** Student-facing: submit a suggestion and track your own. */
export function buildSuggestionsRouter(deps: SuggestionsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      ok(res, await deps.suggestions.listMine(req.user!.id));
    }),
  );

  router.post(
    '/',
    validate({ body: createSuggestionRequestSchema }),
    asyncHandler(async (req, res) => {
      created(res, await deps.suggestions.submit(req.user!.id, req.body));
    }),
  );

  return router;
}

/** Admin-only review queue. Instructors do not manage the syllabus backlog. */
export function buildCmsSuggestionsRouter(deps: SuggestionsRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate, requireRole('ADMIN'));

  router.get(
    '/suggestions',
    asyncHandler(async (req, res) => {
      const status = (req.query.status as SuggestionStatus | undefined) ?? null;
      ok(res, await deps.suggestions.listForReview(status));
    }),
  );

  router.post(
    '/suggestions/:suggestionId/review',
    validate({ body: reviewSuggestionRequestSchema }),
    asyncHandler(async (req, res) => {
      await deps.suggestions.review(req.params.suggestionId as string, req.user!.id, req.body);
      noContent(res);
    }),
  );

  return router;
}
