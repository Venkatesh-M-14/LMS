import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import type { AttemptInProgress } from '@academy/shared';
import { fetchAttempt, quizKeys, saveAnswers, submitAttempt } from './api';
import { ItemInput } from './components/ItemInputs';
import { ResultsView } from './components/ResultsView';

function QuizTaker({ attempt }: { attempt: AttemptInProgress }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, unknown>>(attempt.answers);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounced autosave of only the answers changed since the last flush.
  const dirtyRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const dirty = dirtyRef.current;
    dirtyRef.current = {};
    if (Object.keys(dirty).length === 0) return;
    setSaveState('saving');
    try {
      await saveAnswers(attempt.id, dirty);
      setSaveState('saved');
    } catch {
      // Put the failed answers back so the next flush retries them.
      dirtyRef.current = { ...dirty, ...dirtyRef.current };
      setSaveState('error');
    }
  }, [attempt.id]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleChange = (itemId: string, answer: unknown) => {
    setAnswers((prev) => ({ ...prev, [itemId]: answer }));
    dirtyRef.current[itemId] = answer;
    setSaveState('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 800);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Submit carries the full answer set — nothing depends on autosave timing.
      return submitAttempt(attempt.id, answers);
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(quizKeys.attempt(attempt.id), result);
      // A pass may have completed the lesson, unlocked the next one, and
      // awarded XP / achievements.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['quiz', 'summary'] }),
        queryClient.invalidateQueries({ queryKey: ['gamification'] }),
      ]);
    },
  });

  const answeredCount = attempt.items.filter((item) => {
    const a = answers[item.itemId];
    if (a == null) return false;
    const record = a as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text.trim().length > 0;
    if (typeof record.predictedOutput === 'string') return record.predictedOutput.trim().length > 0;
    if (Array.isArray(record.selectedOptionIds)) return record.selectedOptionIds.length > 0;
    if (record.files && typeof record.files === 'object') {
      return Object.values(record.files as Record<string, string>).some(
        (content) => content.trim().length > 0,
      );
    }
    return true;
  }).length;
  const unanswered = attempt.items.length - answeredCount;

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h1" sx={{ flexGrow: 1 }}>
          {attempt.assessmentTitle}
        </Typography>
        <Chip
          size="small"
          label={
            saveState === 'saving'
              ? t('quiz.saving')
              : saveState === 'saved'
                ? t('quiz.saved')
                : saveState === 'error'
                  ? t('quiz.saveError')
                  : t('quiz.autosave')
          }
          color={saveState === 'error' ? 'error' : 'default'}
          variant="outlined"
        />
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('quiz.progress', { answered: answeredCount, total: attempt.items.length })} ·{' '}
        {t('quiz.passingNote', { pct: attempt.passingScorePct })}
      </Typography>

      {submitMutation.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('quiz.submitFailed')}
        </Alert>
      ) : null}

      <Stack spacing={3}>
        {attempt.items.map((item, index) => (
          <Card key={item.itemId} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <Chip size="small" label={`${index + 1}`} />
                <Typography variant="caption" color="text.secondary">
                  {t(`quiz.types.${item.type}`)} · {t('quiz.points', { count: item.points })}
                </Typography>
              </Stack>
              <ItemInput
                item={item}
                value={answers[item.itemId]}
                onChange={(answer) => handleChange(item.itemId, answer)}
              />
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 4 }}>
        <Button variant="contained" size="large" onClick={() => setConfirmOpen(true)}>
          {t('quiz.submit')}
        </Button>
      </Stack>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t('quiz.submitConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {unanswered > 0
              ? t('quiz.submitConfirmUnanswered', { count: unanswered })
              : t('quiz.submitConfirmAll')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={submitMutation.isPending}
            onClick={() => {
              setConfirmOpen(false);
              submitMutation.mutate();
            }}
          >
            {t('quiz.submit')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export function AttemptPage() {
  const { t } = useTranslation();
  const { attemptId = '' } = useParams();
  const {
    data: attempt,
    isPending,
    isError,
  } = useQuery({
    queryKey: quizKeys.attempt(attemptId),
    queryFn: () => fetchAttempt(attemptId),
    enabled: attemptId.length > 0,
    refetchOnWindowFocus: false,
    // While the judge/instructor grade asynchronously, poll as a fallback to
    // the socket push.
    refetchInterval: (query) => (query.state.data?.status === 'GRADING' ? 2500 : false),
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !attempt) {
    return (
      <Alert
        severity="error"
        action={
          <Button component={RouterLink} to="/curriculum" size="small">
            {t('nav.curriculum')}
          </Button>
        }
      >
        {t('quiz.loadError')}
      </Alert>
    );
  }

  return attempt.status === 'IN_PROGRESS' ? (
    <QuizTaker key={attempt.id} attempt={attempt} />
  ) : (
    <ResultsView result={attempt} />
  );
}
