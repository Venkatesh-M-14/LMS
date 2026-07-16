import { ErrorCodes, type RegisterRequest } from '@academy/shared';
import { ConflictError } from '../../../core/errors/appError';
import type { PasswordHasher, UserRepository } from './ports';
import { startSession, type AuthSessionResult, type SessionDeps } from './authSession';

export interface RegisterUserDeps extends SessionDeps {
  users: UserRepository;
  passwordHasher: PasswordHasher;
}

export class RegisterUser {
  constructor(private readonly deps: RegisterUserDeps) {}

  async execute(
    input: RegisterRequest,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthSessionResult> {
    const existing = await this.deps.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(
        'An account with this email already exists',
        ErrorCodes.EMAIL_ALREADY_REGISTERED,
      );
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.password);
    const user = await this.deps.users.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });

    return startSession(this.deps, user, meta);
  }
}
