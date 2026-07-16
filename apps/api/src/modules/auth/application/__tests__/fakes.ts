import { createHash } from 'node:crypto';
import type {
  Clock,
  CreateRefreshTokenInput,
  CreateUserInput,
  PasswordHasher,
  RefreshTokenRecord,
  RefreshTokenRepository,
  SecureTokenGenerator,
  UserRecord,
  UserRepository,
  AccessTokenSigner,
} from '../ports';
import { ErrorCodes } from '@academy/shared';
import { ConflictError } from '../../../../core/errors/appError';

export class InMemoryUserRepository implements UserRepository {
  readonly rows: UserRecord[] = [];
  private nextId = 1;

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.rows.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.rows.find((u) => u.id === id) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    if (this.rows.some((u) => u.email === input.email)) {
      throw new ConflictError('duplicate', ErrorCodes.EMAIL_ALREADY_REGISTERED);
    }
    const user: UserRecord = {
      id: `user-${this.nextId++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: 'STUDENT',
      status: 'ACTIVE',
      avatarUrl: null,
      locale: 'en',
      timezone: 'UTC',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    this.rows.push(user);
    return user;
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly rows: Array<RefreshTokenRecord & { user: UserRecord }> = [];
  private nextId = 1;

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly clock: Clock,
  ) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new Error(`No user ${input.userId} in fake`);
    const record: RefreshTokenRecord & { user: UserRecord } = {
      id: `rt-${this.nextId++}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      familyId: input.familyId,
      replacedByTokenId: null,
      rotatedAt: null,
      expiresAt: input.expiresAt,
      revokedAt: null,
      user,
    };
    this.rows.push(record);
    return record;
  }

  async findByHash(tokenHash: string): Promise<(RefreshTokenRecord & { user: UserRecord }) | null> {
    return this.rows.find((r) => r.tokenHash === tokenHash) ?? null;
  }

  async rotate(
    oldTokenId: string,
    successor: CreateRefreshTokenInput,
  ): Promise<RefreshTokenRecord> {
    const created = await this.create(successor);
    const old = this.rows.find((r) => r.id === oldTokenId);
    if (!old) throw new Error(`No token ${oldTokenId} in fake`);
    old.replacedByTokenId = created.id;
    old.rotatedAt = this.clock.now();
    return created;
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const row of this.rows) {
      if (row.familyId === familyId && !row.revokedAt) {
        row.revokedAt = this.clock.now();
      }
    }
  }
}

/** Deterministic, instant "hashing" — unit tests must not pay argon2 costs. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async verify(hash: string, plain: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokenGenerator implements SecureTokenGenerator {
  private counter = 0;

  generateToken(): { raw: string; hash: string } {
    const raw = `raw-token-${++this.counter}`;
    return { raw, hash: this.hashToken(raw) };
  }
  generateFamilyId(): string {
    return `family-${++this.counter}`;
  }
  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

export class FakeAccessTokenSigner implements AccessTokenSigner {
  sign(payload: { sub: string; role: string }): { token: string; expiresAtEpochSec: number } {
    return { token: `jwt-for-${payload.sub}`, expiresAtEpochSec: 1_800_000_000 };
  }
}

export class MutableClock implements Clock {
  constructor(private current = new Date('2026-07-15T10:00:00Z')) {}

  now(): Date {
    return new Date(this.current);
  }
  advanceSec(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}
