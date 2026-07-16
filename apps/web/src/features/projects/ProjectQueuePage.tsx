import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { useTranslation } from 'react-i18next';
import { fetchProjectQueue, projectKeys } from './api';
import { ReviewStatusChip } from './components/shared';

export function ProjectQueuePage() {
  const { t, i18n } = useTranslation();
  const {
    data: queue,
    isPending,
    isError,
  } = useQuery({
    queryKey: projectKeys.queue,
    queryFn: fetchProjectQueue,
    refetchInterval: 30_000,
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !queue) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <AssignmentTurnedInIcon color="primary" />
        <Box>
          <Typography variant="h1">{t('projects.queueTitle')}</Typography>
          <Typography color="text.secondary">{t('projects.queueSubtitle')}</Typography>
        </Box>
      </Stack>

      {queue.length === 0 ? (
        <Alert severity="success">{t('projects.queueEmpty')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t('projects.queueTitle')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('grading.student')}</TableCell>
                <TableCell>{t('projects.project')}</TableCell>
                <TableCell>{t('projects.round')}</TableCell>
                <TableCell>{t('grading.submitted')}</TableCell>
                <TableCell>{t('projects.statusLabel')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.map((entry) => (
                <TableRow key={entry.submissionId} hover>
                  <TableCell>{entry.studentName}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{entry.briefTitle}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`projects.kind.${entry.kind}`)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {entry.topicTitle}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>#{entry.submissionRound}</TableCell>
                  <TableCell>
                    {new Date(entry.submittedAt).toLocaleString(i18n.resolvedLanguage)}
                  </TableCell>
                  <TableCell>
                    <ReviewStatusChip status={entry.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      component={RouterLink}
                      to={`/instructor/projects/${entry.submissionId}`}
                    >
                      {t('projects.review')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
