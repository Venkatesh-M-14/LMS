import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { i18n } from '../../../../app/i18n';
import { LoginForm } from '../LoginForm';
import { ApiClientError } from '../../../../shared/api/client';
import * as authApi from '../../api';

vi.mock('../../api');

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(authApi.loginUser).mockReset();
  });

  it('submits valid credentials and calls onSuccess with the session', async () => {
    const session = {
      user: {
        id: 'u1',
        email: 'learner@example.com',
        displayName: 'Learner',
        role: 'STUDENT' as const,
        avatarUrl: null,
        locale: 'en',
        timezone: 'UTC',
        createdAt: new Date().toISOString(),
      },
      accessToken: 'jwt',
      accessTokenExpiresAt: 1_800_000_000,
    };
    vi.mocked(authApi.loginUser).mockResolvedValue(session);
    const onSuccess = vi.fn();

    renderWithProviders(<LoginForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'learner@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'sup3r-secure-pw');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(session));
    // TanStack Query passes (variables, context) — we only care about the payload.
    expect(vi.mocked(authApi.loginUser).mock.calls[0]?.[0]).toEqual({
      email: 'learner@example.com',
      password: 'sup3r-secure-pw',
    });
  });

  it('shows a validation message for a malformed email and does not call the API', async () => {
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'whatever-pw1');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(authApi.loginUser).not.toHaveBeenCalled();
  });

  it('surfaces INVALID_CREDENTIALS as a localized alert', async () => {
    vi.mocked(authApi.loginUser).mockRejectedValue(
      new ApiClientError(401, 'INVALID_CREDENTIALS', 'nope'),
    );

    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'learner@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password1');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email or password is incorrect/i);
  });
});
