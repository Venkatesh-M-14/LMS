import pino, { type Logger } from 'pino';
import type { Env } from '../../config/env';

export type { Logger };

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.passwordHash',
        '*.accessToken',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    },
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
