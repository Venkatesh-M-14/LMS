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
import {
  PrismaAssessmentRepository,
  PrismaAttemptRepository,
  PrismaGradingRepository,
} from './modules/assessments/infrastructure/prismaAssessmentRepositories';
import { AttemptService } from './modules/assessments/application/attemptService';
import { GradingService } from './modules/assessments/application/gradingService';
import { AttemptFinalizer } from './modules/assessments/application/attemptFinalizer';
import { AssessmentAuthoringService } from './modules/assessments/application/assessmentAuthoringService';
import { buildAssessmentsRouter } from './modules/assessments/http/assessmentsRouter';
import { buildCmsAssessmentsRouter } from './modules/assessments/http/cmsAssessmentsRouter';
import { EventBus } from './core/events/eventBus';
import { JudgeService } from './modules/assessments/application/judgeService';
import { BullJudgeQueue } from './modules/judge/infrastructure/judgeQueue';
import { runInSandbox } from './modules/judge/infrastructure/subprocessSandbox';
import type { JwtTokenService as JwtTokenServiceType } from './modules/auth/infrastructure/jwtTokenService';
import { PrismaProgressRepository } from './modules/progress/infrastructure/prismaProgressRepository';
import { ProgressService } from './modules/progress/application/progressService';
import { buildProgressRouter } from './modules/progress/http/progressRouter';
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
    cmsAssessments: Router;
    assessments: Router;
    progress: Router;
  };
  globalRateLimiter: ReturnType<typeof createRateLimiter>;
  eventBus: EventBus;
  judgeService: JudgeService;
  judgeQueue: BullJudgeQueue;
  tokenVerifier: JwtTokenServiceType;
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

  const eventBus = new EventBus(logger);
  const progressService = new ProgressService(new PrismaProgressRepository(prisma));
  // Progress subscribes: a graded, passed quiz completes its lesson (cascade).
  eventBus.on('AttemptGraded', (event) => progressService.onAttemptGraded(event));

  const assessmentRepo = new PrismaAssessmentRepository(prisma);
  const attemptRepo = new PrismaAttemptRepository(prisma);
  const gradingRepo = new PrismaGradingRepository(prisma);
  const judgeQueue = new BullJudgeQueue(env.REDIS_URL);
  const attemptService = new AttemptService({
    assessments: assessmentRepo,
    attempts: attemptRepo,
    clock,
    events: eventBus,
    accessGate: progressService,
    judgeQueue,
  });
  const attemptFinalizer = new AttemptFinalizer({
    attempts: attemptRepo,
    assessments: assessmentRepo,
    grading: gradingRepo,
    clock,
    events: eventBus,
  });
  const gradingService = new GradingService({
    grading: gradingRepo,
    attempts: attemptRepo,
    finalizer: attemptFinalizer,
    clock,
  });
  const assessmentAuthoring = new AssessmentAuthoringService(assessmentRepo);
  const judgeService = new JudgeService({
    attempts: attemptRepo,
    sandbox: runInSandbox,
    finalizer: attemptFinalizer,
    logger,
  });

  const globalRateLimiter = createRateLimiter({
    redis,
    prefix: 'global',
    windowMs: 60_000,
    limit: env.RATE_LIMIT_GLOBAL_PER_MIN,
  });
  const authRateLimiter = createRateLimiter({
    redis,
    prefix: 'auth',
    windowMs: 15 * 60_000,
    limit: env.RATE_LIMIT_AUTH_PER_WINDOW,
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
      curriculum: buildCurriculumRouter({ curriculum, gate: progressService, authenticate }),
      cms: buildCmsRouter({ authoring, authenticate }),
      cmsAssessments: buildCmsAssessmentsRouter({
        authoring: assessmentAuthoring,
        grading: gradingService,
        authenticate,
      }),
      assessments: buildAssessmentsRouter({ attempts: attemptService, authenticate }),
      progress: buildProgressRouter({ progress: progressService, authenticate }),
    },
    globalRateLimiter,
    eventBus,
    judgeService,
    judgeQueue,
    tokenVerifier: jwtService,
    async shutdown() {
      await judgeQueue.close();
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
