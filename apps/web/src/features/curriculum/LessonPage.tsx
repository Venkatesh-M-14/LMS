import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTranslation } from 'react-i18next';
import { ApiClientError } from '../../shared/api/client';
import { curriculumKeys, fetchLessonRead } from './api';
import { BlockRenderer } from './components/BlockRenderer';
import { QuizCard } from '../quiz/components/QuizCard';
import { fetchQuizSummary, quizKeys } from '../quiz/api';
import { fetchProgressMap, markLessonComplete, progressKeys } from '../progress/api';
import { RevisionPanel } from '../adaptive/RevisionPanel';
import { adaptiveKeys } from '../adaptive/api';
import { LessonMentorDrawer } from '../mentor/LessonMentorDrawer';

export function LessonPage() {
  const { t } = useTranslation();
  const { lessonId = '' } = useParams();
  const queryClient = useQueryClient();
  const {
    data: lesson,
    isPending,
    error,
  } = useQuery({
    queryKey: curriculumKeys.lesson(lessonId),
    queryFn: () => fetchLessonRead(lessonId),
    enabled: lessonId.length > 0,
    retry: false,
    // Each visit must register server-side (marks the lesson opened, which
    // completes any revision assignment targeting it) — so never serve a cache
    // hit without re-fetching.
    refetchOnMount: 'always',
  });
  const { data: progress } = useQuery({ queryKey: progressKeys.map, queryFn: fetchProgressMap });
  const { data: quizSummary } = useQuery({
    queryKey: quizKeys.summary(lessonId),
    queryFn: () => fetchQuizSummary(lessonId),
    enabled: lessonId.length > 0 && !error,
  });

  const completeMutation = useMutation({
    mutationFn: () => markLessonComplete(lessonId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: progressKeys.map }),
  });

  // Opening a lesson clears any revision assignments that target it (server-side),
  // which may unblock a gated retake — refresh both once the lesson has loaded.
  useEffect(() => {
    if (!lesson) return;
    void queryClient.invalidateQueries({ queryKey: adaptiveKeys.revisions });
    void queryClient.invalidateQueries({ queryKey: quizKeys.summary(lessonId) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.lessonId]);

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (error || !lesson) {
    const notPublished = error instanceof ApiClientError && error.code === 'LESSON_NOT_PUBLISHED';
    const locked = error instanceof ApiClientError && error.code === 'GATING_LOCKED';
    if (locked) {
      return (
        <Alert
          severity="info"
          icon={<LockIcon />}
          action={
            <Button component={RouterLink} to="/curriculum" size="small">
              {t('nav.curriculum')}
            </Button>
          }
        >
          <Typography sx={{ fontWeight: 600 }}>{t('progress.lockedTitle')}</Typography>
          {t('progress.lockedBody')}
        </Alert>
      );
    }
    return (
      <Alert severity={notPublished ? 'info' : 'error'}>
        {notPublished ? t('curriculum.notPublished') : t('curriculum.loadError')}
      </Alert>
    );
  }

  const lessonProgress = progress?.lessons[lesson.lessonId];
  const isCompleted = lessonProgress?.status === 'COMPLETED';
  const hasQuiz = quizSummary != null;
  const nextLessonId = progress?.nextLessonId ?? null;

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }}>
      <Breadcrumbs sx={{ mb: 2 }} aria-label="breadcrumb">
        <Link component={RouterLink} to="/curriculum" underline="hover" color="inherit">
          {t('nav.curriculum')}
        </Link>
        <Typography color="text.secondary">{lesson.module.title}</Typography>
        <Typography color="text.secondary">{lesson.topic.title}</Typography>
      </Breadcrumbs>

      <Typography variant="h1" gutterBottom>
        {lesson.title}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Chip
          size="small"
          icon={<AccessTimeIcon />}
          label={t('curriculum.minutes', { count: lesson.estimatedMinutes })}
        />
        {isCompleted ? (
          <Chip
            size="small"
            color="success"
            icon={<CheckCircleIcon />}
            label={t('progress.completed')}
          />
        ) : null}
        {lesson.skills.map((skill) => (
          <Chip key={skill.id} size="small" variant="outlined" label={skill.name} />
        ))}
        <Typography variant="caption" color="text.secondary">
          {t('curriculum.versionLabel', { version: lesson.versionNumber })}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 4 }} />

      <Box sx={{ mb: 4 }}>
        <RevisionPanel variant="compact" />
      </Box>

      <BlockRenderer blocks={lesson.blocks} />

      <QuizCard lessonId={lesson.lessonId} />

      {!hasQuiz && !isCompleted ? (
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            startIcon={<TaskAltIcon />}
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {t('progress.markComplete')}
          </Button>
          {completeMutation.isError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('progress.markCompleteFailed')}
            </Alert>
          ) : null}
        </Box>
      ) : null}

      {isCompleted && nextLessonId && nextLessonId !== lesson.lessonId ? (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 4 }}>
          <Button
            component={RouterLink}
            to={`/lessons/${nextLessonId}`}
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
          >
            {t('progress.nextLesson')}
          </Button>
        </Stack>
      ) : null}

      <LessonMentorDrawer lessonId={lesson.lessonId} lessonTitle={lesson.title} />
    </Box>
  );
}
