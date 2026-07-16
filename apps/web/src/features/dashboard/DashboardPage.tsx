import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../app/hooks';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  if (!user) return null; // ProtectedRoute guarantees a user; belt and braces.

  const memberSince = new Date(user.createdAt).toLocaleDateString(i18n.resolvedLanguage, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h1" gutterBottom>
          {t('dashboard.greeting', { name: user.displayName })}
        </Typography>
        <Typography color="text.secondary">{t('dashboard.subtitle')}</Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Card sx={{ flex: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <RocketLaunchIcon color="secondary" aria-hidden />
              <Typography variant="h3" component="h2">
                {t('dashboard.curriculumTitle')}
              </Typography>
            </Stack>
            <Typography color="text.secondary">{t('dashboard.curriculumEmpty')}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h3" component="h2" gutterBottom>
              {t('dashboard.profileTitle')}
            </Typography>
            <Stack spacing={1.5}>
              <Typography>{user.email}</Typography>
              <Box>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={t('dashboard.roleLabel', { role: user.role })}
                />
              </Box>
              <Typography color="text.secondary" variant="body2">
                {t('dashboard.memberSince', { date: memberSince })}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
