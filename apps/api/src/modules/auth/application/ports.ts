import type { Role, UserDto } from '@academy/shared';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Throws ConflictError(EMAIL_ALREADY_REGISTERED) on duplicate email. */
  create(input: CreateUserInput): Promise<UserRecord>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  replacedByTokenId: string | null;
  rotatedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<(RefreshTokenRecord & { user: UserRecord }) | null>;
  /** Atomically creates the successor token and stamps the old row as rotated. */
  rotate(oldTokenId: string, successor: CreateRefreshTokenInput): Promise<RefreshTokenRecord>;
  revokeFamily(familyId: string): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface AccessTokenSigner {
  sign(payload: AccessTokenPayload): { token: string; expiresAtEpochSec: number };
}

export interface AccessTokenVerifier {
  verify(token: string): AccessTokenPayload | null;
}

/** Cryptographically secure opaque-token generation, injectable for tests. */
export interface SecureTokenGenerator {
  /** Returns the raw token (sent to the client once) and its SHA-256 hash (stored). */
  generateToken(): { raw: string; hash: string };
  generateFamilyId(): string;
  hashToken(raw: string): string;
}

export interface Clock {
  now(): Date;
}

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}
