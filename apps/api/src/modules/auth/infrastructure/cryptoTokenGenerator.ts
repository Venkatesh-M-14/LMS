import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SecureTokenGenerator } from '../application/ports';

export class CryptoTokenGenerator implements SecureTokenGenerator {
  generateToken(): { raw: string; hash: string } {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  generateFamilyId(): string {
    return randomUUID();
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
