import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { Container } from './container';
import { requestId } from './core/http/requestContext';
import { createErrorHandler, notFoundHandler } from './core/http/errorHandler';

export function createApp(container: Container): Express {
  const { env, logger, routers } = container;
  const app = express();

  // Express sits behind a reverse proxy in production; trust one hop so
  // req.ip and secure-cookie detection work.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: [env.WEB_ORIGIN],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Liveness/readiness stay outside the global limiter — orchestrators poll them.
  app.use('/', routers.health);

  app.use(container.globalRateLimiter);
  app.use('/api/v1/auth', routers.auth);
  app.use('/api/v1/users', routers.users);
  app.use('/api/v1/curriculum', routers.curriculum);
  app.use('/api/v1/cms', routers.cms);
  app.use('/api/v1/cms', routers.cmsAssessments);
  app.use('/api/v1/assessments', routers.assessments);
  app.use('/api/v1/progress', routers.progress);
  app.use('/api/v1/projects', routers.projects);
  app.use('/api/v1/cms', routers.cmsProjects);
  app.use('/api/v1/gamification', routers.gamification);
  app.use('/api/v1/mentor', routers.mentor);
  app.use('/api/v1/adaptive', routers.adaptive);
  // Public: certificate verification needs no auth (shareable link).
  app.use('/api/v1/verify', routers.certificateVerify);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
