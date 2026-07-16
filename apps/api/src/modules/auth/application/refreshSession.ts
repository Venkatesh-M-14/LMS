import { ErrorCodes } from '@academy/shared';
import { AppError, UnauthorizedError } from '../../../core/errors/appError';
import { toUserDto, type RefreshTokenRecord, type UserRecord } from './ports';
import { addDays, type AuthSessionResult, type SessionDeps } from './authSession';

export interface RefreshSessionDeps extends SessionDeps {
  /** Multi-tab grace: an already-rotated token is honoured for this long. */
  rotationGraceSec: number;
}

/**
 * Rotates a refresh token. Security model:
 *  - unknown / expired / revoked token → 401
 *  - token already rotated OUTSIDE the grace window → token theft assumed,
 *    the entire family is revoked (every device in that chain must re-login)
 *  - token already rotated WITHIN the grace window → benign multi-tab race,
 *    a sibling token is issued from the same family
 */
export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  async execute(
    rawRefreshToken: string,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthSessionResult> {
    const record = await this.deps.refreshTokens.findByHash(
      this.deps.tokens.hashToken(rawRefreshToken),
    );
    if (!record) {
      throw new UnauthorizedError('Refresh token is invalid', ErrorCodes.REFRESH_TOKEN_INVALID);
    }

    const now = this.deps.clock.now();

    if (record.revokedAt || record.expiresAt <= now || record.user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Refresh token is invalid', ErrorCodes.REFRESH_TOKEN_INVALID);
    }

    if (record.replacedByTokenId) {
      const rotatedAtMs = record.rotatedAt?.getTime() ?? 0;
      const withinGrace = now.getTime() - rotatedAtMs <= this.deps.rotationGraceSec * 1000;
      if (!withinGrace) {
        // Reuse of a consumed token: assume theft, kill the whole family.
        await this.deps.refreshTokens.revokeFamily(record.familyId);
        throw new AppError(
          ErrorCodes.REFRESH_TOKEN_REUSED,
          401,
          'Refresh token reuse detected — all sessions in this chain were revoked',
        );
      }
      // Benign race (two tabs refreshing simultaneously): issue a sibling
      // token in the same family without re-stamping the original.
      const sibling = this.deps.tokens.generateToken();
      await this.deps.refreshTokens.create({
        userId: record.userId,
        tokenHash: sibling.hash,
        familyId: record.familyId,
        expiresAt: addDays(now, this.deps.refreshTokenTtlDays),
        ...meta,
      });
      return this.buildResult(record, sibling.raw, now);
    }

    const successor = this.deps.tokens.generateToken();
    await this.deps.refreshTokens.rotate(record.id, {
      userId: record.userId,
      tokenHash: successor.hash,
      familyId: record.familyId,
      expiresAt: addDays(now, this.deps.refreshTokenTtlDays),
      ...meta,
    });
    return this.buildResult(record, successor.raw, now);
  }

  private buildResult(
    record: RefreshTokenRecord & { user: UserRecord },
    rawToken: string,
    now: Date,
  ): AuthSessionResult {
    const access = this.deps.accessTokenSigner.sign({
      sub: record.user.id,
      role: record.user.role,
    });
    return {
      user: toUserDto(record.user),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAtEpochSec,
      refreshToken: rawToken,
      refreshTokenExpiresAt: addDays(now, this.deps.refreshTokenTtlDays),
    };
  }
}
