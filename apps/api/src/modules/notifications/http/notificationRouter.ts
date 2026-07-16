import { Router, type RequestHandler } from 'express';
import {
  markNotificationsReadRequestSchema,
  updateNotificationPreferencesRequestSchema,
} from '@academy/shared';
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

  // Peer chatter is opt-out per user; your own results always notify you.
  router.get(
    '/preferences',
    asyncHandler(async (req, res) => {
      ok(res, await deps.notifications.getPreferences(req.user!.id));
    }),
  );

  router.patch(
    '/preferences',
    validate({ body: updateNotificationPreferencesRequestSchema }),
    asyncHandler(async (req, res) => {
      ok(res, await deps.notifications.updatePreferences(req.user!.id, req.body));
    }),
  );

  return router;
}
