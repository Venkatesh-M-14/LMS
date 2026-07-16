import 'dotenv/config';
import http from 'node:http';
import { loadEnv } from './config/env';
import { buildContainer } from './container';
import { createApp } from './app';

async function main(): Promise<void> {
  const env = loadEnv();
  const container = await buildContainer(env);
  const app = createApp(container);
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    container.logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    container.logger.info({ signal }, 'Shutting down');
    server.close(() => {
      container
        .shutdown()
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
