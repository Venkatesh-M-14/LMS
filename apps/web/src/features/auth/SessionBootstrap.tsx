import { useEffect, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { sessionExpired } from './authSlice';
import { readCsrfToken, tryRefreshSession } from '../../shared/api/client';

/**
 * On first load, attempts to restore the session from the refresh cookie.
 * Children render only once the session status is known, so protected
 * routes never flash a redirect for a user who is actually logged in.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const status = useAppSelector((state) => state.auth.status);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  useEffect(() => {
    if (status !== 'unknown') return;
    if (!readCsrfToken()) {
      dispatch(sessionExpired());
      return;
    }
    void tryRefreshSession().then((refreshed) => {
      if (!refreshed) dispatch(sessionExpired());
    });
  }, [status, dispatch]);

  if (status === 'unknown') {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <CircularProgress />
      </Box>
    );
  }

  return children;
}
