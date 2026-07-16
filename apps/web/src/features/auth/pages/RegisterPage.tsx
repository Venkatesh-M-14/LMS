import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../../app/hooks';
import { sessionStarted } from '../authSlice';
import { AuthCard } from '../components/AuthCard';
import { RegisterForm } from '../components/RegisterForm';

export function RegisterPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <AuthCard title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <RegisterForm
        onSuccess={(session) => {
          dispatch(sessionStarted(session));
          navigate('/', { replace: true });
        }}
      />
      <Typography sx={{ mt: 3, textAlign: 'center' }}>
        {t('auth.haveAccount')}{' '}
        <Link component={RouterLink} to="/login">
          {t('auth.loginLink')}
        </Link>
      </Typography>
    </AuthCard>
  );
}
