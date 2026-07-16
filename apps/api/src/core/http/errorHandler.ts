import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes, type ApiError } from '@academy/shared';
import { AppError, NotFoundError } from '../errors/appError';
import type { Logger } from '../logging/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.path} does not exist`));
}

/** Terminal error middleware — the single place errors become HTTP responses. */
export function createErrorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
      logger[err.httpStatus >= 500 ? 'error' : 'warn'](
        { err, requestId: req.id, code: err.code, status: err.httpStatus },
        err.message,
      );
      const body: ApiError = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
          requestId: String(req.id),
        },
      };
      res.status(err.httpStatus).json(body);
      return;
    }

    // Unexpected error: log everything, reveal nothing.
    logger.error({ err, requestId: req.id }, 'Unhandled error');
    const body: ApiError = {
      error: {
        code: ErrorCodes.INTERNAL,
        message: 'An unexpected error occurred',
        requestId: String(req.id),
      },
    };
    res.status(500).json(body);
  };
}
