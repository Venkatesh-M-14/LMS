import { ErrorCodes } from '@academy/shared';
import { AppError } from '../../../../core/errors/appError';
import { RegisterUser } from '../registerUser';
import { LoginUser } from '../loginUser';
import { RefreshSession } from '../refreshSession';
import { LogoutUser } from '../logoutUser';
import {
  FakeAccessTokenSigner,
  FakePasswordHasher,
  FakeTokenGenerator,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
  MutableClock,
} from './fakes';

function makeWorld() {
  const users = new InMemoryUserRepository();
  const clock = new MutableClock();
  const refreshTokens = new InMemoryRefreshTokenRepository(users, clock);
  const passwordHasher = new FakePasswordHasher();
  const tokens = new FakeTokenGenerator();
  const sessionDeps = {
    refreshTokens,
    tokens,
    accessTokenSigner: new FakeAccessTokenSigner(),
    clock,
    refreshTokenTtlDays: 30,
  };
  return {
    users,
    refreshTokens,
    clock,
    registerUser: new RegisterUser({ ...sessionDeps, users, passwordHasher }),
    loginUser: new LoginUser({
      ...sessionDeps,
      users,
      passwordHasher,
      dummyPasswordHash: 'hashed:not-a-real-password',
    }),
    refreshSession: new RefreshSession({ ...sessionDeps, rotationGraceSec: 30 }),
    logoutUser: new LogoutUser({ refreshTokens, tokens }),
  };
}

const CREDENTIALS = {
  email: 'learner@example.com',
  password: 'sup3r-secure-pw',
  displayName: 'Learner One',
};

async function expectAppError(promise: Promise<unknown>, code: string): Promise<void> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

describe('RegisterUser', () => {
  it('creates a user, hashes the password, and starts a session', async () => {
    const world = makeWorld();
    const session = await world.registerUser.execute(CREDENTIALS);

    expect(session.user.email).toBe(CREDENTIALS.email);
    expect(session.accessToken).toBe(`jwt-for-${session.user.id}`);
    expect(session.refreshToken).toMatch(/^raw-token-/);
    expect(world.users.rows[0]?.passwordHash).toBe(`hashed:${CREDENTIALS.password}`);
    expect(world.refreshTokens.rows).toHaveLength(1);
  });

  it('rejects duplicate emails with EMAIL_ALREADY_REGISTERED', async () => {
    const world = makeWorld();
    await world.registerUser.execute(CREDENTIALS);
    await expectAppError(
      world.registerUser.execute(CREDENTIALS),
      ErrorCodes.EMAIL_ALREADY_REGISTERED,
    );
  });
});

describe('LoginUser', () => {
  it('returns a session for valid credentials', async () => {
    const world = makeWorld();
    await world.registerUser.execute(CREDENTIALS);
    const session = await world.loginUser.execute({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
    });
    expect(session.user.email).toBe(CREDENTIALS.email);
    // A fresh family per login: register + login = 2 token rows.
    expect(world.refreshTokens.rows).toHaveLength(2);
  });

  it.each([
    ['wrong password', { email: CREDENTIALS.email, password: 'wrong-password1' }],
    ['unknown email', { email: 'nobody@example.com', password: CREDENTIALS.password }],
  ])('rejects %s with INVALID_CREDENTIALS', async (_label, input) => {
    const world = makeWorld();
    await world.registerUser.execute(CREDENTIALS);
    await expectAppError(world.loginUser.execute(input), ErrorCodes.INVALID_CREDENTIALS);
  });

  it('rejects suspended accounts with ACCOUNT_SUSPENDED', async () => {
    const world = makeWorld();
    await world.registerUser.execute(CREDENTIALS);
    world.users.rows[0]!.status = 'SUSPENDED';
    await expectAppError(
      world.loginUser.execute({ email: CREDENTIALS.email, password: CREDENTIALS.password }),
      ErrorCodes.ACCOUNT_SUSPENDED,
    );
  });
});

describe('RefreshSession — rotation', () => {
  it('rotates: old token is stamped, successor works, user data returned', async () => {
    const world = makeWorld();
    const first = await world.registerUser.execute(CREDENTIALS);

    const second = await world.refreshSession.execute(first.refreshToken);
    expect(second.user.email).toBe(CREDENTIALS.email);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const oldRow = world.refreshTokens.rows[0]!;
    expect(oldRow.replacedByTokenId).not.toBeNull();
    expect(oldRow.rotatedAt).not.toBeNull();
  });

  it('rejects an unknown token', async () => {
    const world = makeWorld();
    await expectAppError(
      world.refreshSession.execute('never-issued'),
      ErrorCodes.REFRESH_TOKEN_INVALID,
    );
  });

  it('rejects an expired token', async () => {
    const world = makeWorld();
    const session = await world.registerUser.execute(CREDENTIALS);
    world.clock.advanceSec(31 * 24 * 60 * 60);
    await expectAppError(
      world.refreshSession.execute(session.refreshToken),
      ErrorCodes.REFRESH_TOKEN_INVALID,
    );
  });

  it('detects reuse outside the grace window and revokes the whole family', async () => {
    const world = makeWorld();
    const first = await world.registerUser.execute(CREDENTIALS);
    const second = await world.refreshSession.execute(first.refreshToken);

    world.clock.advanceSec(60); // beyond the 30s grace window

    // Replaying the consumed token = theft signal.
    await expectAppError(
      world.refreshSession.execute(first.refreshToken),
      ErrorCodes.REFRESH_TOKEN_REUSED,
    );

    // The legitimate successor must now be dead too.
    await expectAppError(
      world.refreshSession.execute(second.refreshToken),
      ErrorCodes.REFRESH_TOKEN_INVALID,
    );
    expect(world.refreshTokens.rows.every((r) => r.revokedAt !== null)).toBe(true);
  });

  it('tolerates reuse inside the grace window (multi-tab race) with a sibling token', async () => {
    const world = makeWorld();
    const first = await world.registerUser.execute(CREDENTIALS);
    const tabA = await world.refreshSession.execute(first.refreshToken);

    world.clock.advanceSec(5); // still within grace

    const tabB = await world.refreshSession.execute(first.refreshToken);
    expect(tabB.refreshToken).not.toBe(tabA.refreshToken);

    // Both tabs keep working, nothing was revoked.
    await world.refreshSession.execute(tabA.refreshToken);
    await world.refreshSession.execute(tabB.refreshToken);
    expect(world.refreshTokens.rows.some((r) => r.revokedAt !== null)).toBe(false);
  });

  it('rejects tokens of suspended users', async () => {
    const world = makeWorld();
    const session = await world.registerUser.execute(CREDENTIALS);
    world.users.rows[0]!.status = 'SUSPENDED';
    await expectAppError(
      world.refreshSession.execute(session.refreshToken),
      ErrorCodes.REFRESH_TOKEN_INVALID,
    );
  });
});

describe('LogoutUser', () => {
  it('revokes the whole family', async () => {
    const world = makeWorld();
    const session = await world.registerUser.execute(CREDENTIALS);
    await world.logoutUser.execute(session.refreshToken);
    await expectAppError(
      world.refreshSession.execute(session.refreshToken),
      ErrorCodes.REFRESH_TOKEN_INVALID,
    );
  });

  it('is idempotent for unknown tokens', async () => {
    const world = makeWorld();
    await expect(world.logoutUser.execute('never-issued')).resolves.toBeUndefined();
    await expect(world.logoutUser.execute(undefined)).resolves.toBeUndefined();
  });
});
