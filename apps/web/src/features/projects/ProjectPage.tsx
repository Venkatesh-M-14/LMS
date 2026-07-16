import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LockIcon from '@mui/icons-material/Lock';
import { useTranslation } from 'react-i18next';
import { ApiClientError } from '../../shared/api/client';
import { addProjectMessage, fetchProjectForTopic, projectKeys, submitProject } from './api';
import { BriefBody, MessageThread, ReviewStatusChip, ScoresTable } from './components/shared';

export function ProjectPage() {
  const { t } = useTranslation();
  const { topicId = '' } = useParams();
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: projectKeys.topic(topicId),
    queryFn: () => fetchProjectForTopic(topicId),
    enabled: topicId.length > 0,
    retry: false,
  });

  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [notes, setNotes] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectKeys.topic(topicId) });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitProject(data!.brief.id, { repoUrl: repoUrl.trim(), demoUrl: demoUrl.trim(), notes }),
    onSuccess: invalidate,
  });
  const messageMutation = useMutation({
    mutationFn: (body: string) => addProjectMessage(data!.submission!.id, body),
    onSuccess: invalidate,
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    const locked = error instanceof ApiClientError && error.code === 'GATING_LOCKED';
    return (
      <Alert
        severity={locked ? 'info' : 'error'}
        icon={locked ? <LockIcon /> : undefined}
        action={
          <Button component={RouterLink} to="/curriculum" size="small">
            {t('nav.curriculum')}
          </Button>
        }
      >
        {locked ? t('projects.locked') : t('curriculum.loadError')}
      </Alert>
    );
  }

  const { brief, submission } = data;
  const canSubmit = submission === null || submission.status === 'CHANGES_REQUESTED';

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <AssignmentIcon color="secondary" />
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          {brief.title}
        </Typography>
        {submission ? <ReviewStatusChip status={submission.status} /> : null}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Chip size="small" variant="outlined" label={t(`projects.kind.${brief.kind}`)} />
        <Chip size="small" variant="outlined" label={brief.topicTitle} />
        <Chip
          size="small"
          variant="outlined"
          label={t('projects.points', { count: brief.totalPoints })}
        />
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <BriefBody brief={brief} />
      </Paper>

      {submission?.status === 'APPROVED' ? (
        <Alert severity="success" sx={{ mb: 3 }} data-testid="project-approved">
          <Typography sx={{ fontWeight: 600 }}>{t('projects.approvedTitle')}</Typography>
          {t('projects.approvedBody', {
            points: submission.earnedPoints,
            total: brief.totalPoints,
          })}
        </Alert>
      ) : null}
      {submission?.status === 'CHANGES_REQUESTED' ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('projects.changesRequestedBody')}
        </Alert>
      ) : null}
      {submission && (submission.status === 'PENDING' || submission.status === 'IN_REVIEW') ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('projects.awaitingReview')}
        </Alert>
      ) : null}

      {submission ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('projects.yourSubmission', { round: submission.submissionRound })}
          </Typography>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
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
          {submission.status === 'APPROVED' ? (
            <ScoresTable
              brief={brief}
              scores={submission.scores}
              earned={submission.earnedPoints}
            />
          ) : null}
          <Divider sx={{ my: 2 }} />
          <MessageThread
            messages={submission.messages}
            sending={messageMutation.isPending}
            onSend={(body) => messageMutation.mutate(body)}
          />
        </Paper>
      ) : null}

      {canSubmit ? (
        <Paper variant="outlined" sx={{ p: 3 }} data-testid="project-submit-form">
          <Typography variant="subtitle2" gutterBottom>
            {submission ? t('projects.resubmit') : t('projects.submitTitle')}
          </Typography>
          {submitMutation.isError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitMutation.error instanceof ApiClientError
                ? submitMutation.error.message
                : t('projects.submitFailed')}
            </Alert>
          ) : null}
          <Stack spacing={2}>
            <TextField
              label={t('projects.repoUrl')}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/project"
              required
            />
            <TextField
              label={t('projects.demoUrl')}
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://you.github.io/project"
            />
            <TextField
              label={t('projects.notes')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
            />
            <Box>
              <Button
                variant="contained"
                disabled={submitMutation.isPending || repoUrl.trim().length === 0}
                onClick={() => submitMutation.mutate()}
              >
                {submission ? t('projects.resubmitAction') : t('projects.submitAction')}
              </Button>
            </Box>
          </Stack>
        </Paper>
      ) : null}
    </Box>
  );
}
