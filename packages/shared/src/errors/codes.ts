/**
 * Central catalog of machine-readable error codes returned by the API.
 * The web client switches on these — never on error messages.
 */
export const ErrorCodes = {
  // Generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',
  RATE_LIMITED: 'RATE_LIMITED',

  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  CSRF_TOKEN_MISMATCH: 'CSRF_TOKEN_MISMATCH',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
