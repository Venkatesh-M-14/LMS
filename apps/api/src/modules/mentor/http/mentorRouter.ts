import { Router, type RequestHandler } from 'express';
import { sendMentorMessageRequestSchema, startConversationRequestSchema } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { created, ok } from '../../../core/http/respond';
import type { MentorService } from '../application/mentorService';

export interface MentorRouterDeps {
  mentor: MentorService;
  authenticate: RequestHandler;
}

export function buildMentorRouter(deps: MentorRouterDeps): Router {
  const router = Router();
  router.use(deps.authenticate);

  router.get(
    '/budget',
    asyncHandler(async (req, res) => {
      ok(res, await deps.mentor.getBudget(req.user!.id));
    }),
  );

  router.get(
    '/conversations',
    asyncHandler(async (req, res) => {
      ok(res, await deps.mentor.listConversations(req.user!.id));
    }),
  );

  router.post(
    '/conversations',
    validate({ body: startConversationRequestSchema }),
    asyncHandler(async (req, res) => {
      created(res, await deps.mentor.createConversation(req.user!.id, req.body.lessonId ?? null));
    }),
  );

  router.get(
    '/conversations/:conversationId',
    asyncHandler(async (req, res) => {
      ok(res, await deps.mentor.getConversation(req.params.conversationId as string, req.user!.id));
    }),
  );

  // SSE streaming reply. Each chunk is a `data: <json>\n\n` frame.
  router.post(
    '/conversations/:conversationId/messages',
    validate({ body: sendMentorMessageRequestSchema }),
    asyncHandler(async (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const write = (chunk: unknown) => res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      try {
        for await (const chunk of deps.mentor.streamMessage(
          req.params.conversationId as string,
          req.user!.id,
          req.body.message,
        )) {
          write(chunk);
        }
      } catch {
        write({ type: 'error', code: 'INTERNAL', message: 'Streaming failed' });
      } finally {
        res.end();
      }
    }),
  );

  return router;
}
