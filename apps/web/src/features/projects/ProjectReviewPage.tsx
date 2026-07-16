import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RateReviewIcon from '@mui/icons-material/RateReview';
import UndoIcon from '@mui/icons-material/Undo';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useTranslation } from 'react-i18next';
import { ApiClientError } from '../../shared/api/client';
import {
  addReviewMessage,
  approveProject,
  fetchReviewDetail,
  projectKeys,
  requestChanges,
  startReview,
} from './api';
import { BriefBody, MessageThread, ReviewStatusChip } from './components/shared';

export function ProjectReviewPage() {
  const { t, i18n } = useTranslation();
  const { submissionId = '' } = useParams();
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: projectKeys.review(submissionId),
    queryFn: () => fetchReviewDetail(submissionId),
    enabled: submissionId.length > 0,
  });

  const [scores, setScores] = useState<Record<string, { points: string; comment: string }>>({});
  const [changesMessage, setChangesMessage] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.review(submissionId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.queue }),
    ]);
  };
  const onError = (error: unknown) =>
    setActionError(error instanceof ApiClientError ? error.message : t('cms.actionFailed'));

  const startMutation = useMutation({
    mutationFn: () => startReview(submissionId),
    onSuccess: invalidate,
    onError,
  });
  const changesMutation = useMutation({
    mutationFn: () => requestChanges(submissionId, changesMessage.trim()),
    onSuccess: async () => {
      setChangesMessage('');
      await invalidate();
    },
    onError,
  });
  const approveMutation = useMutation({
    mutationFn: () =>
      approveProject(submissionId, {
        scores: (data?.brief.rubric ?? []).map((criterion) => ({
          criterionId: criterion.id,
          points: Number(scores[criterion.id]?.points ?? ''),
          comment: scores[criterion.id]?.comment ?? '',
        })),
        message: '',
      }),
    onSuccess: invalidate,
    onError,
  });
  const messageMutation = useMutation({
    mutationFn: (body: string) => addReviewMessage(submissionId, body),
    onSuccess: invalidate,
    onError,
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

  const { submission, brief, studentName } = data;
  const allScored = brief.rubric.every((criterion) => {
    const value = Number(scores[criterion.id]?.points ?? '');
    return (
      scores[criterion.id]?.points !== undefined &&
      scores[criterion.id]?.points !== '' &&
      !Number.isNaN(value) &&
      value >= 0 &&
      value <= criterion.maxPoints
    );
  });

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
        <Button component={RouterLink} to="/instructor/projects" startIcon={<ArrowBackIcon />}>
          {t('projects.backToQueue')}
        </Button>
        <Typography variant="h2" component="h1" sx={{ flexGrow: 1 }}>
          {brief.title} — {studentName}
        </Typography>
        <ReviewStatusChip status={submission.status} />
      </Stack>

      {actionError ? (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      ) : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Stack spacing={3} sx={{ flex: 3, width: '100%' }}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('projects.submissionRound', {
                round: submission.submissionRound,
                date: new Date(submission.submittedAt).toLocaleString(i18n.resolvedLanguage),
              })}
            </Typography>
            <Stack spacing={0.5}>
              <Link href={submission.repoUrl} target="_blank" rel="noopener noreferrer">
                {submission.repoUrl}
              </Link>
              {submission.demoUrl ? (
                <Link href={submission.demoUrl} target="_blank" rel="noopener noreferrer">
                  {submission.demoUrl}
                </Link>
              ) : null}
              {submission.notes ? (
                <Typography variant="body2" color="text.secondary">
                  {submission.notes}
                </Typography>
              ) : null}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <MessageThread
              messages={submission.messages}
              sending={messageMutation.isPending}
              onSend={(body) => messageMutation.mutate(body)}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <BriefBody brief={brief} />
          </Paper>
        </Stack>

        <Stack
          spacing={2}
          sx={{ flex: 2, width: '100%', position: { md: 'sticky' }, top: { md: 88 } }}
        >
          {submission.status === 'PENDING' ? (
            <Button
              variant="contained"
              startIcon={<RateReviewIcon />}
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              {t('projects.startReview')}
            </Button>
          ) : null}

          {submission.status === 'IN_REVIEW' ? (
            <>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('projects.scoreRubric')}
                </Typography>
                <Stack spacing={2}>
                  {brief.rubric.map((criterion) => (
                    <Stack key={criterion.id} spacing={1}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {criterion.title}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          size="small"
                          type="number"
                          label={t('grading.scoreOf', { max: criterion.maxPoints })}
                          value={scores[criterion.id]?.points ?? ''}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [criterion.id]: {
                                points: e.target.value,
                                comment: prev[criterion.id]?.comment ?? '',
                              },
                            }))
                          }
                          sx={{ width: 130 }}
                        />
                        <TextField
                          size="small"
                          fullWidth
                          label={t('projects.scoreComment')}
                          value={scores[criterion.id]?.comment ?? ''}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [criterion.id]: {
                                points: prev[criterion.id]?.points ?? '',
                                comment: e.target.value,
                              },
                            }))
                          }
                        />
                      </Stack>
                    </Stack>
                  ))}
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<DoneAllIcon />}
                    disabled={!allScored || approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    {t('projects.approve')}
                  </Button>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('projects.requestChangesTitle')}
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    label={t('projects.changesMessage')}
                    value={changesMessage}
                    onChange={(e) => setChangesMessage(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<UndoIcon />}
                    disabled={changesMessage.trim().length < 3 || changesMutation.isPending}
                    onClick={() => changesMutation.mutate()}
                  >
                    {t('cms.requestChanges')}
                  </Button>
                </Stack>
              </Paper>
            </>
          ) : null}

          {submission.status === 'APPROVED' ? (
            <Alert severity="success">
              {t('projects.approvedSummary', {
                points: submission.earnedPoints,
                total: brief.totalPoints,
              })}
            </Alert>
          ) : null}
          {submission.status === 'CHANGES_REQUESTED' ? (
            <Alert severity="warning">{t('projects.waitingOnStudent')}</Alert>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
