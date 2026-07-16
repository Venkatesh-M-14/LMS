import type { RefreshTokenRepository, SecureTokenGenerator } from './ports';

export interface LogoutUserDeps {
  refreshTokens: RefreshTokenRepository;
  tokens: SecureTokenGenerator;
}

/**
 * Revokes the presented token's whole rotation family. Idempotent: logging
 * out with an unknown or already-revoked token still succeeds — there is
 * nothing useful to tell an attacker and nothing for a user to retry.
 */
export class LogoutUser {
  constructor(private readonly deps: LogoutUserDeps) {}

  async execute(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const record = await this.deps.refreshTokens.findByHash(
      this.deps.tokens.hashToken(rawRefreshToken),
    );
    if (record) {
      await this.deps.refreshTokens.revokeFamily(record.familyId);
    }
  }
}
