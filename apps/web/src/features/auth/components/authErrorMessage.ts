import type { TFunction } from 'i18next';
import { ApiClientError, NETWORK_ERROR_CODE } from '../../../shared/api/client';

const KNOWN_CODES = new Set([
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_REGISTERED',
  'ACCOUNT_SUSPENDED',
  'RATE_LIMITED',
]);

/** Maps an API failure to a localized, user-appropriate message. */
export function authErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === NETWORK_ERROR_CODE) return t('auth.errors.NETWORK');
    if (KNOWN_CODES.has(error.code)) return t(`auth.errors.${error.code}`);
  }
  return t('auth.errors.UNEXPECTED');
}
