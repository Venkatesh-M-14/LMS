import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import type { GamificationService } from '../application/gamificationService';

export interface GamificationRouterDeps {
  gamification: GamificationService;
  authenticate: RequestHandler;
}

/** Authenticated stats, achievements, leaderboard, certificates. */
export function buildGamificationRouter(deps: GamificationRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/stats',
    asyncHandler(async (req, res) => {
      ok(res, await deps.gamification.getStats(req.user!.id));
    }),
  );

  router.get(
    '/achievements',
    asyncHandler(async (req, res) => {
      ok(res, await deps.gamification.listAchievements(req.user!.id));
    }),
  );

  router.get(
    '/leaderboard',
    asyncHandler(async (req, res) => {
      ok(res, await deps.gamification.getLeaderboard(req.user!.id));
    }),
  );

  router.get(
    '/certificates',
    asyncHandler(async (req, res) => {
      ok(res, await deps.gamification.listCertificates(req.user!.id));
    }),
  );

  return router;
}

/** Public, unauthenticated certificate verification. */
export function buildCertificateVerifyRouter(deps: { gamification: GamificationService }): Router {
  const router = Router();
  router.get(
    '/:code',
    asyncHandler(async (req, res) => {
      ok(res, await deps.gamification.verifyCertificate(req.params.code as string));
    }),
  );
  return router;
}
