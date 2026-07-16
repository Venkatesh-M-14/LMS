import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { createLessonRequestSchema, type CreateLessonRequest } from '@academy/shared';
import { cmsKeys, createLesson, fetchCmsLessons } from './api';
import { curriculumKeys, fetchPathTree } from '../curriculum/api';
import { VersionStatusChip } from './components/VersionStatusChip';

function NewLessonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: path } = useQuery({ queryKey: curriculumKeys.pathTree, queryFn: fetchPathTree });

  const topics = useMemo(
    () =>
      (path?.modules ?? []).flatMap((module) =>
        module.topics.map((topic) => ({ id: topic.id, label: `${module.title} — ${topic.title}` })),
      ),
    [path],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateLessonRequest>({
    resolver: zodResolver(createLessonRequestSchema),
    defaultValues: { topicId: '', slug: '', title: '', estimatedMinutes: 10 },
  });

  const mutation = useMutation({
    mutationFn: createLesson,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cmsKeys.lessons });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <DialogTitle>{t('cms.newLesson')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {mutation.isError ? <Alert severity="error">{t('cms.actionFailed')}</Alert> : null}
            <TextField
              select
              label={t('cms.topic')}
              defaultValue=""
              required
              error={Boolean(errors.topicId)}
              helperText={errors.topicId?.message}
              {...register('topicId')}
            >
              {topics.map((topic) => (
                <MenuItem key={topic.id} value={topic.id}>
                  {topic.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('cms.lessonTitle')}
              required
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              {...register('title')}
            />
            <TextField
              label={t('cms.slug')}
              required
              error={Boolean(errors.slug)}
              helperText={errors.slug?.message ?? t('cms.slugHelp')}
              {...register('slug')}
            />
            <TextField
              label={t('cms.estimatedMinutes')}
              type="number"
              required
              error={Boolean(errors.estimatedMinutes)}
              helperText={errors.estimatedMinutes?.message}
              {...register('estimatedMinutes', { valueAsNumber: true })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {t('cms.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function InstructorLessonsPage() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    data: lessons,
    isPending,
    isError,
  } = useQuery({
    queryKey: cmsKeys.lessons,
    queryFn: fetchCmsLessons,
  });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !lessons) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h1">{t('cms.lessonsTitle')}</Typography>
          <Typography color="text.secondary">{t('cms.lessonsSubtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          {t('cms.newLesson')}
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={t('cms.lessonsTitle')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('cms.lesson')}</TableCell>
              <TableCell>{t('cms.topic')}</TableCell>
              <TableCell>{t('cms.published')}</TableCell>
              <TableCell>{t('cms.latestVersion')}</TableCell>
              <TableCell>{t('cms.skills')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lessons.map((lesson) => (
              <TableRow key={lesson.id} hover>
                <TableCell>
                  <Button
                    component={RouterLink}
                    to={`/instructor/lessons/${lesson.id}`}
                    size="small"
                  >
                    {lesson.title}
                  </Button>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{lesson.topicTitle}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lesson.moduleTitle}
                  </Typography>
                </TableCell>
                <TableCell>
                  {lesson.publishedVersionNumber ? (
                    <Chip
                      size="small"
                      color="success"
                      label={`v${lesson.publishedVersionNumber}`}
                    />
                  ) : (
                    <Chip size="small" variant="outlined" label={t('cms.never')} />
                  )}
                </TableCell>
                <TableCell>
                  {lesson.latestVersion ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2">v{lesson.latestVersion.versionNumber}</Typography>
                      <VersionStatusChip status={lesson.latestVersion.status} />
                    </Stack>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                    {lesson.skills.map((skill) => (
                      <Chip key={skill.id} size="small" variant="outlined" label={skill.name} />
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <NewLessonDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Stack>
  );
}
