import { Router, type RequestHandler, type Response } from 'express';
import { loginRequestSchema, registerRequestSchema, type AuthResponse } from '@academy/shared';
import { asyncHandler } from '../../../core/http/asyncHandler';
import { validate } from '../../../core/http/validate';
import { created, noContent, ok } from '../../../core/http/respond';
import { clearCsrfToken, issueCsrfToken, requireCsrf } from '../../../core/http/csrf';
import type { RegisterUser } from '../application/registerUser';
import type { LoginUser } from '../application/loginUser';
import type { RefreshSession } from '../application/refreshSession';
import type { LogoutUser } from '../application/logoutUser';
import type { AuthSessionResult } from '../application/authSession';

export const REFRESH_COOKIE = 'academy_refresh';
/** Scope the refresh cookie to the auth endpoints only. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface AuthRouterDeps {
  registerUser: RegisterUser;
  loginUser: LoginUser;
  refreshSession: RefreshSession;
  logoutUser: LogoutUser;
  authRateLimiter: RequestHandler;
  secureCookies: boolean;
}

export function buildAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  const setSession = (res: Response, session: AuthSessionResult): AuthResponse => {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: deps.secureCookies,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: session.refreshTokenExpiresAt,
    });
    issueCsrfToken(res, deps.secureCookies);
    return {
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    };
  };

  const requestMeta = (req: { ip?: string; headers: Record<string, unknown> }) => ({
    ip: req.ip,
    userAgent:
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  });

  router.post(
    '/register',
    deps.authRateLimiter,
    validate({ body: registerRequestSchema }),
    asyncHandler(async (req, res) => {
      const session = await deps.registerUser.execute(req.body, requestMeta(req));
      created(res, setSession(res, session));
    }),
  );

  router.post(
    '/login',
    deps.authRateLimiter,
    validate({ body: loginRequestSchema }),
    asyncHandler(async (req, res) => {
      const session = await deps.loginUser.execute(req.body, requestMeta(req));
      ok(res, setSession(res, session));
    }),
  );

  router.post(
    '/refresh',
    deps.authRateLimiter,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const raw: unknown = req.cookies?.[REFRESH_COOKIE];
      const session = await deps.refreshSession.execute(
        typeof raw === 'string' ? raw : '',
        requestMeta(req),
      );
      ok(res, setSession(res, session));
    }),
  );

  router.post(
    '/logout',
    requireCsrf,
    asyncHandler(async (req, res) => {
      const raw: unknown = req.cookies?.[REFRESH_COOKIE];
      await deps.logoutUser.execute(typeof raw === 'string' ? raw : undefined);
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      clearCsrfToken(res);
      noContent(res);
    }),
  );

  return router;
}
