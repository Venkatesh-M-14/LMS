import { Router, type RequestHandler } from 'express';
import { markNotificationsReadRequestSchema } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { ok } from '../../../core/http/respond';
import { validate } from '../../../core/http/validate';
import type { NotificationService } from '../application/notificationService';

export interface NotificationRouterDeps {
  notifications: NotificationService;
  authenticate: RequestHandler;
}

export function buildNotificationRouter(deps: NotificationRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      ok(res, await deps.notifications.list(req.user!.id));
    }),
  );

  // Mark specific ids read, or all unread when the body omits `ids`.
  router.post(
    '/read',
    validate({ body: markNotificationsReadRequestSchema }),
    asyncHandler(async (req, res) => {
      ok(res, await deps.notifications.markRead(req.user!.id, req.body.ids ?? null));
    }),
  );

  return router;
}
