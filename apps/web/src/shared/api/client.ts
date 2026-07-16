import type { ApiErrorBody, AuthResponse } from '@academy/shared';
import { sessionExpired, sessionRefreshed } from '../../features/auth/authSlice';

/** Thrown for every non-2xx response — carries the API's machine-readable code. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorBody['details'],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK';

interface BoundStore {
  getState: () => { auth: { accessToken: string | null } };
  dispatch: (action: unknown) => unknown;
}

let boundStore: BoundStore | null = null;

/** Called once from the store module — avoids a circular import at load time. */
export function bindApiClient(store: BoundStore): void {
  boundStore = store;
}

export function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)academy_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the automatic silent-refresh retry (used by auth endpoints themselves). */
  skipAuthRetry?: boolean;
}

async function parseError(response: Response): Promise<ApiClientError> {
  try {
    const payload = (await response.json()) as { error?: ApiErrorBody };
    if (payload.error) {
      return new ApiClientError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    }
  } catch {
    // fall through — body was not the standard envelope
  }
  return new ApiClientError(response.status, 'UNEXPECTED', `HTTP ${response.status}`);
}

async function rawRequest(path: string, options: RequestOptions, accessToken: string | null) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    return await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, NETWORK_ERROR_CODE, 'Network request failed');
  }
}

// Single-flight: concurrent 401s share one refresh call instead of racing.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const csrf = readCsrfToken();
      if (!csrf) return false;
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as { data: AuthResponse };
      boundStore?.dispatch(sessionRefreshed(payload.data));
      return true;
    } catch {
      return false;
    } finally {
      // Allow the next expiry to trigger a fresh refresh cycle.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

/**
 * JSON API client. On a 401 it attempts one silent refresh (cookie + CSRF
 * double-submit) and replays the request; if that fails the session is
 * declared expired and the UI routes back to login.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = boundStore?.getState().auth.accessToken ?? null;
  let response = await rawRequest(path, options, token);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefreshSession();
    if (!refreshed) {
      boundStore?.dispatch(sessionExpired());
      throw await parseError(response);
    }
    const freshToken = boundStore?.getState().auth.accessToken ?? null;
    response = await rawRequest(path, options, freshToken);
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export { tryRefreshSession };
