import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { toUserDto, type UserRepository } from '../../auth/application/ports';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { ok } from '../../../core/http/respond';
import { NotFoundError } from '../../../core/errors/appError';
import { requireRole } from '../../../core/http/authenticate';
import type { PrismaClient } from '../../../core/db/prisma';

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface UsersRouterDeps {
  users: UserRepository;
  prisma: PrismaClient;
  authenticate: RequestHandler;
}

export function buildUsersRouter(deps: UsersRouterDeps): Router {
  const router = Router();

  router.get(
    '/me',
    deps.authenticate,
    asyncHandler(async (req, res) => {
      const user = await deps.users.findById(req.user!.id);
      if (!user) throw new NotFoundError('User no longer exists');
      ok(res, toUserDto(user));
    }),
  );

  // Admin-only user listing (offset pagination — admin tables need jump-to-page).
  router.get(
    '/',
    deps.authenticate,
    requireRole('ADMIN'),
    validate({ query: listUsersQuerySchema }),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = req.query as unknown as z.infer<typeof listUsersQuerySchema>;
      const [rows, total] = await Promise.all([
        deps.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        deps.prisma.user.count(),
      ]);
      ok(res, rows.map(toUserDto), { page, pageSize, total });
    }),
  );

  return router;
}
