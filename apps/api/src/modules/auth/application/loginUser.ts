import { ErrorCodes, type LoginRequest } from '@academy/shared';
import { AppError, UnauthorizedError } from '../../../core/errors/appError';
import type { PasswordHasher, UserRepository } from './ports';
import { startSession, type AuthSessionResult, type SessionDeps } from './authSession';

export interface LoginUserDeps extends SessionDeps {
  users: UserRepository;
  passwordHasher: PasswordHasher;
  /**
   * A valid argon2 hash of a throwaway value. When the email is unknown we
   * still verify against this, so response timing does not reveal whether an
   * account exists.
   */
  dummyPasswordHash: string;
}

export class LoginUser {
  constructor(private readonly deps: LoginUserDeps) {}

  async execute(
    input: LoginRequest,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthSessionResult> {
    const user = await this.deps.users.findByEmail(input.email);

    const hashToCheck = user?.passwordHash ?? this.deps.dummyPasswordHash;
    const passwordValid = await this.deps.passwordHasher.verify(hashToCheck, input.password);

    if (!user || !passwordValid) {
      throw new UnauthorizedError('Email or password is incorrect', ErrorCodes.INVALID_CREDENTIALS);
    }
    if (user.status === 'SUSPENDED') {
      throw new AppError(ErrorCodes.ACCOUNT_SUSPENDED, 403, 'This account has been suspended');
    }

    return startSession(this.deps, user, meta);
  }
}
