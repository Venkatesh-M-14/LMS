import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { loginRequestSchema, type LoginRequest } from '@academy/shared';
import { useTranslation } from 'react-i18next';
import { loginUser } from '../api';
import { authErrorMessage } from './authErrorMessage';

interface LoginFormProps {
  onSuccess: (session: Awaited<ReturnType<typeof loginUser>>) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (session) => onSuccess(session),
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Stack spacing={2.5}>
        {mutation.isError ? (
          <Alert severity="error">{authErrorMessage(t, mutation.error)}</Alert>
        ) : null}

        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          autoFocus
          required
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          required
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" variant="contained" size="large" disabled={mutation.isPending}>
          {t('auth.loginButton')}
        </Button>
      </Stack>
    </form>
  );
}
