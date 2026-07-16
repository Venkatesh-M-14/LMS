import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import BoltIcon from '@mui/icons-material/Bolt';
import { useTranslation } from 'react-i18next';
import { fetchStats, gamificationKeys } from '../api';

/** Compact XP + streak indicator for the app bar. */
export function StatsBadge() {
  const { t } = useTranslation();
  const { data: stats } = useQuery({ queryKey: gamificationKeys.stats, queryFn: fetchStats });
  if (!stats) return null;

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mr: 0.5 }}>
      <Tooltip title={t('gamification.levelTip', { level: stats.level })}>
        <Chip
          size="small"
          icon={<BoltIcon />}
          label={`${t('gamification.level')} ${stats.level}`}
          color="primary"
          variant="outlined"
        />
      </Tooltip>
      {stats.currentStreak > 0 ? (
        <Tooltip title={t('gamification.streakTip', { count: stats.currentStreak })}>
          <Chip
            size="small"
            icon={<LocalFireDepartmentIcon />}
            label={stats.currentStreak}
            color={stats.activeToday ? 'warning' : 'default'}
            variant="outlined"
          />
        </Tooltip>
      ) : (
        <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
      )}
    </Stack>
  );
}
