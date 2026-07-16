import type { UserDto } from '@academy/shared';
import type {
  AccessTokenSigner,
  Clock,
  RefreshTokenRepository,
  SecureTokenGenerator,
  UserRecord,
} from './ports';
import { toUserDto } from './ports';

export interface AuthSessionResult {
  user: UserDto;
  accessToken: string;
  accessTokenExpiresAt: number;
  /** Raw refresh token — delivered to the client exactly once, via cookie. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface SessionDeps {
  refreshTokens: RefreshTokenRepository;
  tokens: SecureTokenGenerator;
  accessTokenSigner: AccessTokenSigner;
  clock: Clock;
  refreshTokenTtlDays: number;
}

/** Starts a brand-new refresh-token family (login / register). */
export async function startSession(
  deps: SessionDeps,
  user: UserRecord,
  meta: { ip?: string; userAgent?: string },
): Promise<AuthSessionResult> {
  const { raw, hash } = deps.tokens.generateToken();
  const expiresAt = addDays(deps.clock.now(), deps.refreshTokenTtlDays);

  await deps.refreshTokens.create({
    userId: user.id,
    tokenHash: hash,
    familyId: deps.tokens.generateFamilyId(),
    expiresAt,
    ...meta,
  });

  const access = deps.accessTokenSigner.sign({ sub: user.id, role: user.role });
  return {
    user: toUserDto(user),
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAtEpochSec,
    refreshToken: raw,
    refreshTokenExpiresAt: expiresAt,
  };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
