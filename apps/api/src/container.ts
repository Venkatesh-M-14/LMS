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
import { GamificationService } from './modules/gamification/application/gamificationService';
import { PrismaGamificationRepository } from './modules/gamification/infrastructure/prismaGamificationRepository';
import { RedisLeaderboard } from './modules/gamification/infrastructure/redisLeaderboard';
import {
  buildCertificateVerifyRouter,
  buildGamificationRouter,
} from './modules/gamification/http/gamificationRouter';
import { MentorService } from './modules/mentor/application/mentorService';
import { PrismaMentorRepository } from './modules/mentor/infrastructure/prismaMentorRepository';
import { AnthropicProvider } from './modules/mentor/infrastructure/anthropicProvider';
import {
  FakeMentorProvider,
  UnconfiguredMentorProvider,
} from './modules/mentor/infrastructure/fakeProvider';
import { buildMentorRouter } from './modules/mentor/http/mentorRouter';
import type { LlmProvider } from './modules/mentor/application/llmProvider';
import { AdaptiveService } from './modules/adaptive/application/adaptiveService';
import { PrismaAdaptiveRepository } from './modules/adaptive/infrastructure/prismaAdaptiveRepository';
import { buildAdaptiveRouter } from './modules/adaptive/http/adaptiveRouter';
import { NotificationService } from './modules/notifications/application/notificationService';
import { PrismaNotificationRepository } from './modules/notifications/infrastructure/prismaNotificationRepository';
import { buildNotificationRouter } from './modules/notifications/http/notificationRouter';
import { EmailService } from './modules/email/application/emailService';
import { PrismaEmailRepository } from './modules/email/infrastructure/prismaEmailRepository';
import { NodemailerSender } from './modules/email/infrastructure/nodemailerSender';
import { BullEmailQueue } from './modules/email/infrastructure/emailQueue';
import { AnalyticsService } from './modules/analytics/application/analyticsService';
import { PrismaAnalyticsRepository } from './modules/analytics/infrastructure/prismaAnalyticsRepository';
import { buildAnalyticsRouter } from './modules/analytics/http/analyticsRouter';
import { ChatService } from './modules/chat/application/chatService';
import { PrismaChatRepository } from './modules/chat/infrastructure/prismaChatRepository';
import { buildChatRouter } from './modules/chat/http/chatRouter';
import { SuggestionService } from './modules/suggestions/application/suggestionService';
import { PrismaSuggestionRepository } from './modules/suggestions/infrastructure/prismaSuggestionRepository';
import {
  buildCmsSuggestionsRouter,
  buildSuggestionsRouter,
} from './modules/suggestions/http/suggestionsRouter';
import { ProjectService } from './modules/projects/application/projectService';
import { PrismaProjectRepository } from './modules/projects/infrastructure/prismaProjectRepository';
import {
  buildCmsProjectsRouter,
  buildProjectsRouter,
} from './modules/projects/http/projectsRouter';
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
    projects: Router;
    cmsProjects: Router;
    gamification: Router;
    certificateVerify: Router;
    mentor: Router;
    adaptive: Router;
    notifications: Router;
    analytics: Router;
    chat: Router;
    suggestions: Router;
    cmsSuggestions: Router;
  };
  globalRateLimiter: ReturnType<typeof createRateLimiter>;
  eventBus: EventBus;
  judgeService: JudgeService;
  judgeQueue: BullJudgeQueue;
  notificationService: NotificationService;
  emailService: EmailService;
  chatService: ChatService;
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

  // The typed in-process bus: the one channel for cross-module effects.
  const eventBus = new EventBus(logger);

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

  const registerUser = new RegisterUser({ ...sessionDeps, users, passwordHasher, events: eventBus });
  const loginUser = new LoginUser({ ...sessionDeps, users, passwordHasher, dummyPasswordHash });
  const refreshSession = new RefreshSession({
    ...sessionDeps,
    rotationGraceSec: env.REFRESH_ROTATION_GRACE_SEC,
  });
  const logoutUser = new LogoutUser({ refreshTokens, tokens });

  const authenticate = createAuthenticate(jwtService);

  const authoring = new LessonAuthoringService(new PrismaAuthoringRepository(prisma));
  const curriculum = new CurriculumQueryService(prisma);

  const adaptiveService = new AdaptiveService({
    repo: new PrismaAdaptiveRepository(prisma),
    events: eventBus,
    logger,
  });
  const progressService = new ProgressService(new PrismaProgressRepository(prisma), eventBus);
  // Progress subscribes: a graded, passed quiz completes its lesson (cascade).
  eventBus.on('AttemptGraded', (event) => progressService.onAttemptGraded(event));
  eventBus.on('AttemptGraded', (event) => adaptiveService.onAttemptGraded(event));

  // Gamification subscribes to the same events for XP, achievements, certificates.
  const gamificationService = new GamificationService({
    repo: new PrismaGamificationRepository(prisma),
    leaderboard: new RedisLeaderboard(redis),
    clock,
    events: eventBus,
    logger,
  });
  eventBus.on('AttemptGraded', (event) => gamificationService.onAttemptGraded(event));
  eventBus.on('ProjectApproved', (event) => gamificationService.onProjectApproved(event));
  eventBus.on('LessonCompleted', (event) => gamificationService.onLessonCompleted(event));

  // Notifications: in-app center, live-pushed over Socket.IO (server.ts wires
  // the pusher). Subscribes across the domain events users care about.
  const notificationService = new NotificationService({
    repo: new PrismaNotificationRepository(prisma),
    logger,
  });
  eventBus.on('AttemptGraded', (event) => notificationService.onAttemptGraded(event));
  eventBus.on('AchievementUnlocked', (event) => notificationService.onAchievementUnlocked(event));
  eventBus.on('CertificateIssued', (event) => notificationService.onCertificateIssued(event));
  eventBus.on('ProjectReviewed', (event) => notificationService.onProjectReviewed(event));
  eventBus.on('RevisionAssigned', (event) => notificationService.onRevisionAssigned(event));
  // M10: the circle hears about each other.
  eventBus.on('LeaderboardOvertaken', (event) => notificationService.onLeaderboardOvertaken(event));
  eventBus.on('SuggestionSubmitted', (event) => notificationService.onSuggestionSubmitted(event));
  eventBus.on('SuggestionReviewed', (event) => notificationService.onSuggestionReviewed(event));

  // Email outbox: subscribers write PENDING rows; a BullMQ worker (server.ts)
  // drains them. No SMTP configured → the worker no-ops, so nothing blocks.
  const emailQueue = new BullEmailQueue(env.REDIS_URL);
  const emailService = new EmailService({
    repo: new PrismaEmailRepository(prisma),
    queue: emailQueue,
    sender: new NodemailerSender({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.EMAIL_FROM,
    }),
    webOrigin: env.WEB_ORIGIN,
    logger,
  });
  eventBus.on('UserRegistered', (event) => emailService.onUserRegistered(event));
  eventBus.on('CertificateIssued', (event) => emailService.onCertificateIssued(event));
  eventBus.on('ProjectReviewed', (event) => emailService.onProjectReviewed(event));

  // Analytics: append-only stream. Server-side capture of authoritative funnel
  // events; the client posts the rest to /analytics/events.
  const analyticsService = new AnalyticsService({
    repo: new PrismaAnalyticsRepository(prisma),
    clock,
    logger,
  });
  eventBus.on('AttemptGraded', (event) => analyticsService.onAttemptGraded(event));

  // Chat: one channel model behind the group room, DMs and lesson threads.
  const chatService = new ChatService({ repo: new PrismaChatRepository(prisma), logger });

  // AI Mentor provider: real Anthropic when a key is present, deterministic
  // fake when explicitly selected (dev/CI), else an unconfigured placeholder.
  let mentorProvider: LlmProvider;
  if (env.MENTOR_PROVIDER === 'fake') {
    mentorProvider = new FakeMentorProvider();
  } else if (env.ANTHROPIC_API_KEY) {
    mentorProvider = new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.MENTOR_MODEL });
  } else {
    mentorProvider = new UnconfiguredMentorProvider();
  }
  const mentorService = new MentorService({
    repo: new PrismaMentorRepository(prisma),
    provider: mentorProvider,
    clock,
    dailyTokenBudget: env.MENTOR_DAILY_TOKEN_BUDGET,
    logger,
  });

  const assessmentRepo = new PrismaAssessmentRepository(prisma);

  // Syllabus suggestions: accepting a draft appends it to the lesson's bank,
  // so it needs the assessment repository above.
  const suggestionService = new SuggestionService({
    repo: new PrismaSuggestionRepository(prisma),
    assessments: assessmentRepo,
    events: eventBus,
    logger,
  });
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
    retakeGate: adaptiveService,
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
  const projectService = new ProjectService({
    repo: new PrismaProjectRepository(prisma),
    gate: progressService,
    clock,
    events: eventBus,
  });
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
      curriculum: buildCurriculumRouter({
        curriculum,
        gate: progressService,
        onLessonOpened: async (userId, lessonId) => {
          await adaptiveService.onLessonOpened(userId, lessonId);
          await analyticsService.recordLessonOpened(userId, lessonId);
        },
        authenticate,
      }),
      cms: buildCmsRouter({ authoring, authenticate }),
      cmsAssessments: buildCmsAssessmentsRouter({
        authoring: assessmentAuthoring,
        grading: gradingService,
        authenticate,
      }),
      assessments: buildAssessmentsRouter({ attempts: attemptService, authenticate }),
      progress: buildProgressRouter({ progress: progressService, authenticate }),
      projects: buildProjectsRouter({ projects: projectService, authenticate }),
      cmsProjects: buildCmsProjectsRouter({ projects: projectService, authenticate }),
      gamification: buildGamificationRouter({ gamification: gamificationService, authenticate }),
      certificateVerify: buildCertificateVerifyRouter({ gamification: gamificationService }),
      mentor: buildMentorRouter({ mentor: mentorService, authenticate }),
      adaptive: buildAdaptiveRouter({ adaptive: adaptiveService, authenticate }),
      notifications: buildNotificationRouter({ notifications: notificationService, authenticate }),
      analytics: buildAnalyticsRouter({ analytics: analyticsService, authenticate }),
      chat: buildChatRouter({ chat: chatService, authenticate }),
      suggestions: buildSuggestionsRouter({ suggestions: suggestionService, authenticate }),
      cmsSuggestions: buildCmsSuggestionsRouter({ suggestions: suggestionService, authenticate }),
    },
    globalRateLimiter,
    eventBus,
    judgeService,
    judgeQueue,
    notificationService,
    emailService,
    chatService,
    tokenVerifier: jwtService,
    async shutdown() {
      await judgeQueue.close();
      await emailQueue.close();
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
