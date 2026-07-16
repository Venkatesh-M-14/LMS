import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useTranslation } from 'react-i18next';
import { fetchAchievements, gamificationKeys } from './api';
import { AchievementIcon } from './components/AchievementIcon';

export function AchievementsPage() {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: gamificationKeys.achievements,
    queryFn: fetchAchievements,
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  const earnedCount = data.filter((achievement) => achievement.earned).length;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <EmojiEventsIcon color="secondary" />
        <Box>
          <Typography variant="h1">{t('gamification.achievementsTitle')}</Typography>
          <Typography color="text.secondary">
            {t('gamification.achievementsProgress', { earned: earnedCount, total: data.length })}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
        }}
      >
        {data.map((achievement) => (
          <Card
            key={achievement.slug}
            variant="outlined"
            data-testid={`achievement-${achievement.slug}`}
            sx={{ opacity: achievement.earned ? 1 : 0.55 }}
          >
            <CardContent>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                <AchievementIcon
                  icon={achievement.icon}
                  color={achievement.earned ? 'secondary' : 'disabled'}
                  fontSize="large"
                />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{achievement.title}</Typography>
                  {achievement.xpReward > 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      +{achievement.xpReward} {t('gamification.xp')}
                    </Typography>
                  ) : null}
                </Box>
                {achievement.earned ? (
                  <Chip size="small" color="success" label={t('gamification.earned')} />
                ) : (
                  <Chip size="small" variant="outlined" label={t('gamification.locked')} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {achievement.description}
              </Typography>
              {achievement.earned && achievement.earnedAt ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block' }}
                >
                  {t('gamification.earnedOn', {
                    date: new Date(achievement.earnedAt).toLocaleDateString(i18n.resolvedLanguage),
                  })}
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
