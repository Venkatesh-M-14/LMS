import type Redis from 'ioredis';
import type { LeaderboardEntry } from '@academy/shared';
import { levelForXp } from '@academy/shared';
import type { Leaderboard } from '../application/ports';

const KEY = 'leaderboard:alltime';

/**
 * Redis ZSET leaderboard. Writes are absolute (ZADD with the user's fresh
 * total), reads use ZREVRANGE / ZREVRANK. Postgres remains the source of
 * truth; this is a fast index that rebuild() can reconstruct after a flush.
 */
export class RedisLeaderboard implements Leaderboard {
  constructor(private readonly redis: Redis) {}

  async addXp(userId: string, totalXp: number): Promise<void> {
    await this.redis.zadd(KEY, totalXp, userId);
  }

  async topEntries(limit: number): Promise<Array<{ userId: string; totalXp: number }>> {
    const raw = await this.redis.zrevrange(KEY, 0, limit - 1, 'WITHSCORES');
    const entries: Array<{ userId: string; totalXp: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ userId: raw[i]!, totalXp: Number(raw[i + 1]) });
    }
    return entries;
  }

  async rankOf(userId: string): Promise<number | null> {
    const rank = await this.redis.zrevrank(KEY, userId);
    return rank === null ? null : rank + 1;
  }

  async rebuild(all: Array<{ userId: string; totalXp: number }>): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.del(KEY);
    for (const entry of all) {
      if (entry.totalXp > 0) pipeline.zadd(KEY, entry.totalXp, entry.userId);
    }
    await pipeline.exec();
  }

  toEntries(
    resolved: Array<{ userId: string; displayName: string; totalXp: number; level: number }>,
    ranks: Map<string, number>,
    currentUserId: string,
  ): LeaderboardEntry[] {
    return resolved
      .filter((row) => ranks.has(row.userId))
      .map((row) => ({
        rank: ranks.get(row.userId)!,
        userId: row.userId,
        displayName: row.displayName,
        totalXp: row.totalXp,
        level: row.level || levelForXp(row.totalXp),
        isCurrentUser: row.userId === currentUserId,
      }));
  }
}
