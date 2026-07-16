import type { AuthResponse, LoginRequest, RegisterRequest, UserDto } from '@academy/shared';
import { apiRequest, readCsrfToken } from '../../shared/api/client';

export function registerUser(input: RegisterRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
    skipAuthRetry: true,
  });
}

export function loginUser(input: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    skipAuthRetry: true,
  });
}

export async function logoutUser(): Promise<void> {
  const csrf = readCsrfToken();
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    credentials: 'same-origin',
  });
}

export function fetchCurrentUser(): Promise<UserDto> {
  return apiRequest<UserDto>('/users/me');
}
