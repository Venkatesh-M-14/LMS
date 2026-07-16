import { useQuery } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import { ApiClientError } from '../../shared/api/client';
import { curriculumKeys, fetchLessonRead } from './api';
import { BlockRenderer } from './components/BlockRenderer';

export function LessonPage() {
  const { t } = useTranslation();
  const { lessonId = '' } = useParams();
  const {
    data: lesson,
    isPending,
    error,
  } = useQuery({
    queryKey: curriculumKeys.lesson(lessonId),
    queryFn: () => fetchLessonRead(lessonId),
    enabled: lessonId.length > 0,
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (error || !lesson) {
    const notPublished = error instanceof ApiClientError && error.code === 'LESSON_NOT_PUBLISHED';
    return (
      <Alert severity={notPublished ? 'info' : 'error'}>
        {notPublished ? t('curriculum.notPublished') : t('curriculum.loadError')}
      </Alert>
    );
  }

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
        {lesson.skills.map((skill) => (
          <Chip key={skill.id} size="small" variant="outlined" label={skill.name} />
        ))}
        <Typography variant="caption" color="text.secondary">
          {t('curriculum.versionLabel', { version: lesson.versionNumber })}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 4 }} />

      <BlockRenderer blocks={lesson.blocks} />
    </Box>
  );
}
