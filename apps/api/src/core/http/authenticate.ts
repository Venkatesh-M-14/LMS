import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@academy/shared';
import { ForbiddenError, UnauthorizedError } from '../errors/appError';
import type { AccessTokenVerifier } from '../../modules/auth/application/ports';

/** Verifies the Bearer access token and attaches req.user. */
export function createAuthenticate(verifier: AccessTokenVerifier): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new UnauthorizedError());
      return;
    }
    const payload = verifier.verify(header.slice('Bearer '.length));
    if (!payload) {
      next(new UnauthorizedError('Access token is invalid or expired'));
      return;
    }
    req.user = { id: payload.sub, role: payload.role };
    next();
  };
}

/** Role gate — must run after authenticate. Admins pass every gate. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (req.user.role !== 'ADMIN' && !roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
