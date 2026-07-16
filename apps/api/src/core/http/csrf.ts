import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes } from '@academy/shared';
import { AppError } from '../errors/appError';

export const CSRF_COOKIE = 'academy_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit CSRF protection for the cookie-borne refresh token. The token
 * is intentionally NOT httpOnly: the web app reads it and echoes it in a
 * header, which a cross-site attacker cannot do.
 */
export function issueCsrfToken(res: Response, secure: boolean): string {
  const token = randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function clearCsrfToken(res: Response): void {
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  const cookieToken: unknown = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length === 0
  ) {
    next(new AppError(ErrorCodes.CSRF_TOKEN_MISMATCH, 403, 'CSRF token missing'));
    return;
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    next(new AppError(ErrorCodes.CSRF_TOKEN_MISMATCH, 403, 'CSRF token mismatch'));
    return;
  }
  next();
}
