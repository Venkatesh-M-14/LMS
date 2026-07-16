import 'dotenv/config';
import http from 'node:http';
import { loadEnv } from './config/env';
import { buildContainer } from './container';
import { createApp } from './app';
import { createSocketServer } from './core/realtime/socket';
import { startJudgeWorker } from './modules/judge/infrastructure/judgeQueue';

async function main(): Promise<void> {
  const env = loadEnv();
  const container = await buildContainer(env);
  const app = createApp(container);
  const server = http.createServer(app);

  // Realtime: authenticated sockets join user rooms; grading pushes land there.
  const io = createSocketServer(server, container.tokenVerifier, env.WEB_ORIGIN);
  container.eventBus.on('AttemptGraded', (event) => {
    io.to(`user:${event.userId}`).emit('attempt:graded', {
      assessmentId: event.assessmentId,
      lessonId: event.lessonId,
      passed: event.passed,
      scorePct: event.scorePct,
    });
  });

  // Judge worker (in-process for now; same code can run standalone later).
  const judgeWorker = startJudgeWorker(
    env.REDIS_URL,
    container.judgeService,
    env.JUDGE_CONCURRENCY,
    container.logger,
  );

  server.listen(env.PORT, () => {
    container.logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    container.logger.info({ signal }, 'Shutting down');
    io.close();
    server.close(() => {
      judgeWorker
        .close()
        .then(() => container.shutdown())
        .catch((err) => container.logger.error({ err }, 'Error during shutdown'))
        .finally(() => process.exit(0));
    });
    // Hard exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // Logger may not exist yet (env validation failures) — console is correct here.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
