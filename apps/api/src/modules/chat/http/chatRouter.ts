import { Router, type RequestHandler } from 'express';
import { sendChatMessageRequestSchema, startDirectChannelRequestSchema } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { created, noContent, ok } from '../../../core/http/respond';
import { validate } from '../../../core/http/validate';
import type { ChatService } from '../application/chatService';

export interface ChatRouterDeps {
  chat: ChatService;
  authenticate: RequestHandler;
}

export function buildChatRouter(deps: ChatRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/channels',
    asyncHandler(async (req, res) => {
      ok(res, await deps.chat.listChannels(req.user!.id));
    }),
  );

  /** Members you can start a DM with. */
  router.get(
    '/peers',
    asyncHandler(async (req, res) => {
      ok(res, await deps.chat.listPeers(req.user!.id));
    }),
  );

  /** The circle-wide room (created on first use). */
  router.get(
    '/channels/group',
    asyncHandler(async (req, res) => {
      ok(res, await deps.chat.getGroupChannel(req.user!.id));
    }),
  );

  /** The discussion thread for a lesson (created on first use). */
  router.get(
    '/channels/lesson/:lessonId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.chat.getLessonChannel(req.params.lessonId as string, req.user!.id));
    }),
  );

  router.post(
    '/channels/direct',
    validate({ body: startDirectChannelRequestSchema }),
    asyncHandler(async (req, res) => {
      created(res, await deps.chat.startDirectChannel(req.user!.id, req.body.userId));
    }),
  );

  router.get(
    '/channels/:channelId/messages',
    asyncHandler(async (req, res) => {
      const before = typeof req.query.before === 'string' ? req.query.before : undefined;
      ok(res, await deps.chat.getMessages(req.params.channelId as string, req.user!.id, before));
    }),
  );

  router.post(
    '/channels/:channelId/messages',
    validate({ body: sendChatMessageRequestSchema }),
    asyncHandler(async (req, res) => {
      created(
        res,
        await deps.chat.postMessage(req.params.channelId as string, req.user!.id, req.body.body),
      );
    }),
  );

  router.post(
    '/channels/:channelId/read',
    asyncHandler(async (req, res) => {
      await deps.chat.markRead(req.params.channelId as string, req.user!.id);
      noContent(res);
    }),
  );

  return router;
}
