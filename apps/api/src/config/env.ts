import { z } from 'zod';

/**
 * Environment configuration, validated once at boot. The process refuses to
 * start with a missing or malformed configuration — fail fast, not at 3am.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_ORIGIN: z.string().url().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(
      32,
      'JWT_ACCESS_SECRET must be at least 32 characters — generate with: openssl rand -hex 32',
    ),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_ROTATION_GRACE_SEC: z.coerce.number().int().nonnegative().default(30),
  /** Reverse-proxy hops in front of Express: 1 = Caddy/nginx only,
   * 2 = Vercel rewrite proxy + Caddy. Decides which X-Forwarded-For entry
   * becomes req.ip for per-IP rate limiting. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  /** Auth endpoints: requests per 15-minute window per IP. */
  RATE_LIMIT_AUTH_PER_WINDOW: z.coerce.number().int().positive().default(30),
  /** All other API endpoints: requests per minute per IP. */
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().positive().default(300),
  /** Concurrent sandbox processes per judge worker. */
  JUDGE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  // AI Mentor (Claude API). Absent key → mentor reports "not configured".
  ANTHROPIC_API_KEY: z.string().optional(),
  MENTOR_MODEL: z.string().default('claude-sonnet-5'),
  /** 'anthropic' (real API) or 'fake' (deterministic, for dev/CI). */
  MENTOR_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
  MENTOR_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(50_000),
  // Email outbox (M9). With no SMTP_HOST the drain worker no-ops and marks
  // messages SENT (dev without mailpit) — the app never blocks on mail.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Frontend Academy <no-reply@academy.local>'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
