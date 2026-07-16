import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import LinearProgress from '@mui/material/LinearProgress';
import { useAppSelector } from '../../app/hooks';
import { curriculumKeys, fetchPathTree } from '../curriculum/api';
import { fetchProgressMap, progressKeys } from '../progress/api';
import { fetchStats, gamificationKeys } from '../gamification/api';
import { RevisionPanel } from '../adaptive/RevisionPanel';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const { data: path } = useQuery({ queryKey: curriculumKeys.pathTree, queryFn: fetchPathTree });
  const { data: progress } = useQuery({ queryKey: progressKeys.map, queryFn: fetchProgressMap });

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
                {progress && progress.totalLessons > 0 ? (
                  <Box sx={{ maxWidth: 420 }}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.round(
                            (progress.completedLessons / progress.totalLessons) * 100,
                          )}
                          aria-label={t('progress.pathProgress')}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('progress.lessonsDone', {
                          done: progress.completedLessons,
                          total: progress.totalLessons,
                        })}
                      </Typography>
                    </Stack>
                  </Box>
                ) : null}
                <Box>
                  <Button
                    component={RouterLink}
                    to={
                      progress?.nextLessonId ? `/lessons/${progress.nextLessonId}` : '/curriculum'
                    }
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                  >
                    {progress && progress.completedLessons > 0
                      ? t('progress.continue')
                      : t('dashboard.startLearning')}
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">{t('dashboard.curriculumEmpty')}</Typography>
            )}
          </CardContent>
        </Card>

        <Stack spacing={3} sx={{ flex: 1 }}>
          <StatsCard />
          <RevisionPanel variant="full" />
          <Card>
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
    </Stack>
  );
}

function StatsCard() {
  const { t } = useTranslation();
  const { data: stats } = useQuery({ queryKey: gamificationKeys.stats, queryFn: fetchStats });
  if (!stats) return null;

  const levelPct =
    stats.nextLevelXp > 0 ? Math.round((stats.levelXp / stats.nextLevelXp) * 100) : 100;

  return (
    <Card data-testid="dashboard-stats">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <BoltIcon color="primary" />
          <Typography variant="h3" component="h2">
            {t('gamification.yourProgress')}
          </Typography>
        </Stack>
        <Stack spacing={2}>
          <Stack direction="row" spacing={3}>
            <Box>
              <Typography variant="h2" component="p">
                {stats.totalXp}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('gamification.xp')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="h2" component="p">
                {stats.level}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('gamification.level')}
              </Typography>
            </Box>
            <Box>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="h2" component="p">
                  {stats.currentStreak}
                </Typography>
                <LocalFireDepartmentIcon color={stats.activeToday ? 'warning' : 'disabled'} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t('gamification.dayStreak')}
              </Typography>
            </Box>
          </Stack>
          <Box>
            <LinearProgress
              variant="determinate"
              value={levelPct}
              aria-label={t('gamification.levelProgress')}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('gamification.toNextLevel', {
                have: stats.levelXp,
                need: stats.nextLevelXp,
                level: stats.level + 1,
              })}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
