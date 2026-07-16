import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import QuizIcon from '@mui/icons-material/Quiz';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { ApiClientError } from '../../../shared/api/client';
import { track } from '../../../shared/analytics/analytics';
import { fetchQuizSummary, quizKeys, startAttempt } from '../api';

/** The quiz entry point shown at the bottom of a lesson. */
export function QuizCard({ lessonId }: { lessonId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: summary } = useQuery({
    queryKey: quizKeys.summary(lessonId),
    queryFn: () => fetchQuizSummary(lessonId),
  });

  const startMutation = useMutation({
    mutationFn: () => startAttempt(summary!.id),
    onSuccess: (attempt) => {
      track('quiz.started', { assessmentId: summary!.id, lessonId });
      navigate(`/attempts/${attempt.id}`);
    },
  });

  if (!summary) return null;

  const last = summary.lastAttempt;
  const pending = last?.status === 'GRADING';

  return (
    <Card variant="outlined" sx={{ mt: 5 }} data-testid="quiz-card">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <QuizIcon color="secondary" aria-hidden />
          <Typography variant="h3" component="h2" sx={{ flexGrow: 1 }}>
            {summary.title}
          </Typography>
          {last?.passed === true ? (
            <Chip color="success" size="small" label={t('quiz.passed')} />
          ) : null}
          {last?.passed === false ? (
            <Chip color="error" size="small" label={t('quiz.notPassedYet')} />
          ) : null}
          {pending ? <Chip color="warning" size="small" label={t('quiz.pendingGrading')} /> : null}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('quiz.meta', {
            count: summary.itemCount,
            points: summary.totalPoints,
            passing: summary.passingScorePct,
          })}
          {summary.maxAttempts
            ? ` · ${t('quiz.attemptsUsed', { used: summary.attemptsUsed, max: summary.maxAttempts })}`
            : ''}
          {summary.bestScorePct !== null
            ? ` · ${t('quiz.best', { pct: summary.bestScorePct })}`
            : ''}
        </Typography>

        {startMutation.isError ? (
          startMutation.error instanceof ApiClientError &&
          startMutation.error.code === 'REVISION_REQUIRED' ? (
            <Alert severity="warning" sx={{ mb: 2 }} data-testid="retake-blocked">
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {t('adaptive.retakeBlockedTitle')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('adaptive.retakeBlockedBody')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {(startMutation.error.details ?? []).map((d) => (
                  <Button
                    key={d.path}
                    component={RouterLink}
                    to={`/lessons/${d.path}`}
                    size="small"
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                  >
                    {d.message}
                  </Button>
                ))}
              </Stack>
            </Alert>
          ) : (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t('quiz.startFailed')}
            </Alert>
          )
        ) : null}

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
          {summary.activeAttemptId ? (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate(`/attempts/${summary.activeAttemptId}`)}
            >
              {t('quiz.resume')}
            </Button>
          ) : summary.canStart ? (
            <Button
              variant="contained"
              startIcon={summary.attemptsUsed > 0 ? <ReplayIcon /> : <PlayArrowIcon />}
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              {summary.attemptsUsed > 0 ? t('quiz.retake') : t('quiz.start')}
            </Button>
          ) : (
            <Alert severity="info" sx={{ flexGrow: 1 }}>
              {summary.blockedReason === 'MAX_ATTEMPTS'
                ? t('quiz.noAttemptsLeft')
                : t('quiz.cooldown', {
                    time: summary.cooldownEndsAt
                      ? new Date(summary.cooldownEndsAt).toLocaleTimeString(i18n.resolvedLanguage)
                      : '',
                  })}
            </Alert>
          )}

          {last ? (
            <Button
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => navigate(`/attempts/${last.id}`)}
            >
              {t('quiz.viewLastResult')}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
