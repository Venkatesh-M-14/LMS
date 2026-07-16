import { rateLimit, type RateLimitRequestHandler, type Store } from 'express-rate-limit';
import type Redis from 'ioredis';
import { ErrorCodes, type ApiError } from '@academy/shared';

/**
 * Minimal Redis store for express-rate-limit (fixed window via INCR+PEXPIRE).
 * Hand-rolled to avoid an ESM-only dependency; ~equivalent to rate-limit-redis.
 */
class RedisRateLimitStore implements Store {
  private windowMs = 60_000;

  /**
   * Public per the Store contract: express-rate-limit uses it to tell
   * multiple limiter instances apart (its double-count validation).
   */
  readonly prefix: string;

  constructor(
    private readonly redis: Redis,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `rl:${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = this.key(key);
    const results = await this.redis
      .multi()
      .incr(redisKey)
      .pexpire(redisKey, this.windowMs, 'NX')
      .pttl(redisKey)
      .exec();
    if (!results) {
      throw new Error('Redis transaction for rate limiting failed');
    }
    const totalHits = results[0]?.[1] as number;
    const ttlMs = results[2]?.[1] as number;
    return { totalHits, resetTime: new Date(Date.now() + Math.max(ttlMs, 0)) };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.key(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.key(key));
  }
}

const rateLimitedBody: ApiError = {
  error: {
    code: ErrorCodes.RATE_LIMITED,
    message: 'Too many requests — please slow down and try again shortly',
  },
};

interface LimiterOptions {
  redis: Redis;
  prefix: string;
  windowMs: number;
  limit: number;
}

export function createRateLimiter({
  redis,
  prefix,
  windowMs,
  limit,
}: LimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new RedisRateLimitStore(redis, prefix),
    message: rateLimitedBody,
  });
}
