import { ErrorCodes, type ErrorCode } from '@academy/shared';

interface AppErrorOptions {
  details?: Array<{ path: string; message: string }>;
  cause?: unknown;
}

/**
 * Base class for every error the API intentionally returns. Anything that is
 * not an AppError reaching the terminal error middleware is treated as an
 * unexpected 500 and never leaks internals to the client.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(code: ErrorCode, httpStatus: number, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(details: Array<{ path: string; message: string }>) {
    super(ErrorCodes.VALIDATION_FAILED, 400, 'Request validation failed', { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code: ErrorCode = ErrorCodes.UNAUTHORIZED) {
    super(code, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(ErrorCodes.FORBIDDEN, 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(ErrorCodes.NOT_FOUND, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.CONFLICT) {
    super(code, 409, message);
  }
}
