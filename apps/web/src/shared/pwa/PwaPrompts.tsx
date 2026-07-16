import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useTranslation } from 'react-i18next';

/**
 * Registers the service worker and surfaces two unobtrusive states:
 *  - a "new version — reload" prompt when an update is waiting,
 *  - an offline banner while the network is down (lessons stay readable from
 *    cache; grading is blocked online-only by the SW routing).
 */
export function PwaPrompts() {
  const { t } = useTranslation();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
    });
    setUpdateSW(() => update);

    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <>
      <Snackbar open={offline} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="warning" variant="filled" sx={{ width: '100%' }}>
          {t('pwa.offline')}
        </Alert>
      </Snackbar>

      <Snackbar open={needRefresh} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert
          severity="info"
          variant="filled"
          action={
            <Button color="inherit" size="small" onClick={() => void updateSW?.(true)}>
              {t('pwa.reload')}
            </Button>
          }
        >
          {t('pwa.updateReady')}
        </Alert>
      </Snackbar>
    </>
  );
}
