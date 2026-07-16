import argon2 from 'argon2';
import type { PasswordHasher } from '../application/ports';

/** OWASP-recommended argon2id parameters (19 MiB memory, 2 iterations). */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Malformed hash (e.g. the injected dummy) must read as "wrong password",
      // never as a 500.
      return false;
    }
  }
}
