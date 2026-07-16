import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../../app/hooks';
import { sessionStarted } from '../authSlice';
import { AuthCard } from '../components/AuthCard';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  return (
    <AuthCard title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <LoginForm
        onSuccess={(session) => {
          dispatch(sessionStarted(session));
          navigate(from, { replace: true });
        }}
      />
      <Typography sx={{ mt: 3, textAlign: 'center' }}>
        {t('auth.noAccount')}{' '}
        <Link component={RouterLink} to="/register">
          {t('auth.registerLink')}
        </Link>
      </Typography>
    </AuthCard>
  );
}
