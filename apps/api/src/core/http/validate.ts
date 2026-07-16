import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors/appError';

interface ValidationTargets {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and REPLACES request parts with their parsed (trimmed, coerced,
 * defaulted) values, so handlers only ever see contract-conformant data.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: Array<{ path: string; message: string }> = [];

    for (const [key, schema] of Object.entries(targets) as Array<
      [keyof ValidationTargets, ZodType]
    >) {
      const result = schema.safeParse(req[key]);
      if (result.success) {
        if (key === 'body') {
          req.body = result.data;
        } else {
          // Express 5 exposes query/params via getters; redefine instead of assigning.
          Object.defineProperty(req, key, { value: result.data, writable: true });
        }
      } else {
        issues.push(
          ...result.error.issues.map((issue) => ({
            path: [key, ...issue.path].join('.'),
            message: issue.message,
          })),
        );
      }
    }

    if (issues.length > 0) {
      next(new ValidationError(issues));
      return;
    }
    next();
  };
}
