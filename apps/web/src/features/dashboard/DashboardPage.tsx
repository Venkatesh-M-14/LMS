import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../app/hooks';
import { curriculumKeys, fetchPathTree } from '../curriculum/api';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const { data: path } = useQuery({ queryKey: curriculumKeys.pathTree, queryFn: fetchPathTree });

  const stats = path
    ? {
        modules: path.modules.length,
        topics: path.modules.reduce((sum, m) => sum + m.topics.length, 0),
        lessons: path.modules.reduce(
          (sum, m) =>
            sum + m.topics.reduce((s, t2) => s + t2.lessons.filter((l) => l.isPublished).length, 0),
          0,
        ),
      }
    : null;

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
                {path?.title ?? t('dashboard.curriculumTitle')}
              </Typography>
            </Stack>
            {stats ? (
              <Stack spacing={2}>
                <Typography color="text.secondary">{path?.description}</Typography>
                <Stack direction="row" spacing={3}>
                  <Box>
                    <Typography variant="h2" component="p">
                      {stats.modules}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('dashboard.modules')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h2" component="p">
                      {stats.topics}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('dashboard.topics')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h2" component="p">
                      {stats.lessons}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('dashboard.lessonsAvailable')}
                    </Typography>
                  </Box>
                </Stack>
                <Box>
                  <Button
                    component={RouterLink}
                    to="/curriculum"
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                  >
                    {t('dashboard.startLearning')}
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">{t('dashboard.curriculumEmpty')}</Typography>
            )}
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
