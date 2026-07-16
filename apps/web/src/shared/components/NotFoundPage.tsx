import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h1">404</Typography>
      <Typography variant="h3" component="h2">
        {t('errors.notFoundTitle')}
      </Typography>
      <Typography color="text.secondary">{t('errors.notFoundBody')}</Typography>
      <Button component={RouterLink} to="/" variant="contained">
        {t('errors.backHome')}
      </Button>
    </Box>
  );
}
