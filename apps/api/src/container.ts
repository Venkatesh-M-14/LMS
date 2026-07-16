import { randomBytes } from 'node:crypto';
import Redis from 'ioredis';
import type { Env } from './config/env';
import { createLogger, type Logger } from './core/logging/logger';
import { createPrismaClient, type PrismaClient } from './core/db/prisma';
import { createAuthenticate } from './core/http/authenticate';
import { createRateLimiter } from './core/http/rateLimit';
import { PrismaUserRepository } from './modules/auth/infrastructure/prismaUserRepository';
import { PrismaRefreshTokenRepository } from './modules/auth/infrastructure/prismaRefreshTokenRepository';
import { Argon2PasswordHasher } from './modules/auth/infrastructure/argon2PasswordHasher';
import { JwtTokenService } from './modules/auth/infrastructure/jwtTokenService';
import { CryptoTokenGenerator } from './modules/auth/infrastructure/cryptoTokenGenerator';
import { RegisterUser } from './modules/auth/application/registerUser';
import { LoginUser } from './modules/auth/application/loginUser';
import { RefreshSession } from './modules/auth/application/refreshSession';
import { LogoutUser } from './modules/auth/application/logoutUser';
import { buildAuthRouter } from './modules/auth/http/authRouter';
import { buildUsersRouter } from './modules/users/http/usersRouter';
import { buildHealthRouter } from './modules/health/http/healthRouter';
import { PrismaAuthoringRepository } from './modules/cms/infrastructure/prismaAuthoringRepository';
import { LessonAuthoringService } from './modules/cms/application/lessonAuthoringService';
import { buildCmsRouter } from './modules/cms/http/cmsRouter';
import { CurriculumQueryService } from './modules/curriculum/application/curriculumQueryService';
import { buildCurriculumRouter } from './modules/curriculum/http/curriculumRouter';
import type { Router } from 'express';

export interface Container {
  env: Env;
  logger: Logger;
  prisma: PrismaClient;
  redis: Redis;
  routers: {
    auth: Router;
    users: Router;
    health: Router;
    curriculum: Router;
    cms: Router;
  };
  globalRateLimiter: ReturnType<typeof createRateLimiter>;
  shutdown(): Promise<void>;
}

/**
 * Composition root: the single place where the object graph is wired.
 * Everything below receives its dependencies through constructors — no module
 * reaches out to globals.
 */
export async function buildContainer(env: Env): Promise<Container> {
  const logger = createLogger(env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
  redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));

  const clock = { now: () => new Date() };
  const tokens = new CryptoTokenGenerator();
  const passwordHasher = new Argon2PasswordHasher();
  const jwtService = new JwtTokenService({
    secret: env.JWT_ACCESS_SECRET,
    ttlSec: env.ACCESS_TOKEN_TTL_SEC,
    issuer: 'frontend-engineering-academy',
  });

  const users = new PrismaUserRepository(prisma);
  const refreshTokens = new PrismaRefreshTokenRepository(prisma);

  const sessionDeps = {
    refreshTokens,
    tokens,
    accessTokenSigner: jwtService,
    clock,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  };

  // Hashed at boot so login timing is identical for unknown emails.
  const dummyPasswordHash = await passwordHasher.hash(randomBytes(32).toString('hex'));

  const registerUser = new RegisterUser({ ...sessionDeps, users, passwordHasher });
  const loginUser = new LoginUser({ ...sessionDeps, users, passwordHasher, dummyPasswordHash });
  const refreshSession = new RefreshSession({
    ...sessionDeps,
    rotationGraceSec: env.REFRESH_ROTATION_GRACE_SEC,
  });
  const logoutUser = new LogoutUser({ refreshTokens, tokens });

  const authenticate = createAuthenticate(jwtService);

  const authoring = new LessonAuthoringService(new PrismaAuthoringRepository(prisma));
  const curriculum = new CurriculumQueryService(prisma);

  const globalRateLimiter = createRateLimiter({
    redis,
    prefix: 'global',
    windowMs: 60_000,
    limit: 300,
  });
  const authRateLimiter = createRateLimiter({
    redis,
    prefix: 'auth',
    windowMs: 15 * 60_000,
    limit: 30,
  });

  return {
    env,
    logger,
    prisma,
    redis,
    routers: {
      auth: buildAuthRouter({
        registerUser,
        loginUser,
        refreshSession,
        logoutUser,
        authRateLimiter,
        secureCookies: env.NODE_ENV === 'production',
      }),
      users: buildUsersRouter({ users, prisma, authenticate }),
      health: buildHealthRouter({ prisma, redis }),
      curriculum: buildCurriculumRouter({ curriculum, authenticate }),
      cms: buildCmsRouter({ authoring, authenticate }),
    },
    globalRateLimiter,
    async shutdown() {
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
