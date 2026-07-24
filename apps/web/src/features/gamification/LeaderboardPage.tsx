import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { useTranslation } from 'react-i18next';
import type { LeaderboardEntry } from '@academy/shared';
import { fetchLeaderboard, gamificationKeys } from './api';

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useTranslation();
  const pct =
    entry.totalLessons > 0 ? Math.round((entry.lessonsCompleted / entry.totalLessons) * 100) : 0;
  return (
    <TableRow selected={entry.isCurrentUser} hover>
      <TableCell
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: entry.rank <= 3 ? 700 : 400 }}
      >
        {medal(entry.rank)}
      </TableCell>
      <TableCell>
        {entry.displayName}
        {entry.isCurrentUser ? (
          <Chip size="small" color="primary" label={t('gamification.you')} sx={{ ml: 1 }} />
        ) : null}
        {entry.currentTopicTitle ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {t('gamification.onTopic', { topic: entry.currentTopicTitle })}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell sx={{ minWidth: 140 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ flexGrow: 1 }}>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {entry.lessonsCompleted}/{entry.totalLessons}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
        {t('gamification.level')} {entry.level}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 600 }}>
        {entry.totalXp} {t('gamification.xp')}
      </TableCell>
    </TableRow>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: gamificationKeys.leaderboard,
    queryFn: fetchLeaderboard,
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

  const topIds = new Set(data.entries.map((entry) => entry.userId));
  const showCurrentSeparately = data.currentUser && !topIds.has(data.currentUser.userId);

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <LeaderboardIcon color="primary" />
        <Box>
          <Typography variant="h1">{t('gamification.leaderboardTitle')}</Typography>
          <Typography color="text.secondary">{t('gamification.leaderboardSubtitle')}</Typography>
        </Box>
      </Stack>

      {data.entries.length === 0 ? (
        <Alert severity="info">{t('gamification.leaderboardEmpty')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t('gamification.leaderboardTitle')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('gamification.rank')}</TableCell>
                <TableCell>{t('gamification.learner')}</TableCell>
                <TableCell>{t('gamification.progress')}</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  {t('gamification.level')}
                </TableCell>
                <TableCell align="right">{t('gamification.xp')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.entries.map((entry) => (
                <Row key={entry.userId} entry={entry} />
              ))}
              {showCurrentSeparately ? (
                <>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ p: 0 }}>
                      <Divider />
                    </TableCell>
                  </TableRow>
                  <Row entry={data.currentUser!} />
                </>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
