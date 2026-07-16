import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@academy/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware. */
      user?: { id: string; role: Role };
    }
  }
}

const REQUEST_ID_PATTERN = /^[\w.-]{1,128}$/;

/** Correlation id — honoured from X-Request-Id (if well-formed) or generated. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const candidate =
    typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : undefined;
  req.id = candidate ?? randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
