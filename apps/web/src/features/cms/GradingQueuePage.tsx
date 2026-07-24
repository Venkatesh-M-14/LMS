import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GradingIcon from '@mui/icons-material/Grading';
import { useTranslation } from 'react-i18next';
import type { GradingSubmissionView } from '@academy/shared';
import { cmsKeys, fetchGradingDetail, fetchGradingQueue, gradeSubmission } from './api';

function ReflectionGrader({
  submission,
  onGraded,
}: {
  submission: GradingSubmissionView;
  onGraded: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState<string>(submission.manualScore?.toString() ?? '');
  const [feedback, setFeedback] = useState(submission.graderFeedback);

  const mutation = useMutation({
    mutationFn: () => gradeSubmission(submission.submissionId, { score: Number(score), feedback }),
    onSuccess: onGraded,
  });

  const numericScore = Number(score);
  const valid =
    score !== '' &&
    !Number.isNaN(numericScore) &&
    numericScore >= 0 &&
    numericScore <= submission.points;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{submission.prompt}</Typography>
        {submission.guidance ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {submission.guidance}
          </Typography>
        ) : null}
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>
            {submission.answerText || t('grading.emptyAnswer')}
          </Typography>
        </Box>
        {mutation.isError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('cms.actionFailed')}
          </Alert>
        ) : null}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            label={t('grading.scoreOf', { max: submission.points })}
            type="number"
            size="small"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            error={score !== '' && !valid}
            sx={{ width: 140 }}
          />
          <TextField
            label={t('grading.feedback')}
            size="small"
            fullWidth
            multiline
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <Button
            variant="contained"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {submission.manualScore !== null ? t('grading.updateScore') : t('grading.saveScore')}
          </Button>
        </Stack>
        {submission.manualScore !== null ? (
          <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
            {t('grading.gradedAs', { score: submission.manualScore, max: submission.points })}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GradingDialog({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: detail, isPending } = useQuery({
    queryKey: cmsKeys.gradingDetail(attemptId),
    queryFn: () => fetchGradingDetail(attemptId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: cmsKeys.gradingDetail(attemptId) }),
      queryClient.invalidateQueries({ queryKey: cmsKeys.gradingQueue }),
    ]);
  };

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>
        {detail
          ? t('grading.dialogTitle', { student: detail.studentName, quiz: detail.assessmentTitle })
          : t('common.loading')}
      </DialogTitle>
      <DialogContent>
        {isPending || !detail ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {detail.reflections.every((s) => s.manualScore !== null) ? (
              <Alert severity="success">{t('grading.allDone')}</Alert>
            ) : null}
            {detail.reflections.map((submission) => (
              <ReflectionGrader
                key={submission.submissionId}
                submission={submission}
                onGraded={refresh}
              />
            ))}
            <Divider />
            <Box sx={{ textAlign: 'right' }}>
              <Button onClick={onClose}>{t('grading.close')}</Button>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function GradingQueuePage() {
  const { t, i18n } = useTranslation();
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const {
    data: queue,
    isPending,
    isError,
  } = useQuery({
    queryKey: cmsKeys.gradingQueue,
    queryFn: fetchGradingQueue,
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
        <GradingIcon color="primary" />
        <Box>
          <Typography variant="h1">{t('grading.title')}</Typography>
          <Typography color="text.secondary">{t('grading.subtitle')}</Typography>
        </Box>
      </Stack>

      {queue.length === 0 ? (
        <Alert severity="success">{t('grading.emptyQueue')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t('grading.title')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('grading.student')}</TableCell>
                <TableCell>{t('grading.quiz')}</TableCell>
                <TableCell>{t('grading.submitted')}</TableCell>
                <TableCell>{t('grading.pending')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.map((entry) => (
                <TableRow key={entry.attemptId} hover>
                  <TableCell>{entry.studentName}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{entry.assessmentTitle}</Typography>
                    {entry.lessonTitle ? (
                      <Typography variant="caption" color="text.secondary">
                        {entry.lessonTitle}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {new Date(entry.submittedAt).toLocaleString(i18n.resolvedLanguage)}
                  </TableCell>
                  <TableCell>{entry.pendingItems}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setOpenAttemptId(entry.attemptId)}
                    >
                      {t('grading.grade')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {openAttemptId ? (
        <GradingDialog attemptId={openAttemptId} onClose={() => setOpenAttemptId(null)} />
      ) : null}
    </Stack>
  );
}
