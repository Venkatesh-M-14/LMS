import jwt from 'jsonwebtoken';
import { roleSchema } from '@academy/shared';
import type {
  AccessTokenPayload,
  AccessTokenSigner,
  AccessTokenVerifier,
} from '../application/ports';

interface JwtTokenServiceOptions {
  secret: string;
  ttlSec: number;
  issuer: string;
}

export class JwtTokenService implements AccessTokenSigner, AccessTokenVerifier {
  constructor(private readonly options: JwtTokenServiceOptions) {}

  sign(payload: AccessTokenPayload): { token: string; expiresAtEpochSec: number } {
    const expiresAtEpochSec = Math.floor(Date.now() / 1000) + this.options.ttlSec;
    const token = jwt.sign({ role: payload.role }, this.options.secret, {
      algorithm: 'HS256',
      subject: payload.sub,
      issuer: this.options.issuer,
      expiresIn: this.options.ttlSec,
    });
    return { token, expiresAtEpochSec };
  }

  verify(token: string): AccessTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.options.secret, {
        algorithms: ['HS256'],
        issuer: this.options.issuer,
      });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
      const role = roleSchema.safeParse(decoded.role);
      if (!role.success) return null;
      return { sub: decoded.sub, role: role.data };
    } catch {
      return null;
    }
  }
}
