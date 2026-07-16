import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { registerRequestSchema, type RegisterRequest } from '@academy/shared';
import { useTranslation } from 'react-i18next';
import { registerUser } from '../api';
import { authErrorMessage } from './authErrorMessage';

interface RegisterFormProps {
  onSuccess: (session: Awaited<ReturnType<typeof registerUser>>) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (session) => onSuccess(session),
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Stack spacing={2.5}>
        {mutation.isError ? (
          <Alert severity="error">{authErrorMessage(t, mutation.error)}</Alert>
        ) : null}

        <TextField
          label={t('auth.displayName')}
          autoComplete="name"
          autoFocus
          required
          error={Boolean(errors.displayName)}
          helperText={errors.displayName?.message}
          {...register('displayName')}
        />
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          required
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" variant="contained" size="large" disabled={mutation.isPending}>
          {t('auth.registerButton')}
        </Button>
      </Stack>
    </form>
  );
}
