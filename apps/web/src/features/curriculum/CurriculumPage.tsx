import { useQuery } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { UnitProgress } from '@academy/shared';
import { curriculumKeys, fetchPathTree } from './api';
import { fetchProgressMap, progressKeys } from '../progress/api';
import { fetchBriefSummaries, projectKeys } from '../projects/api';
import AssignmentIcon from '@mui/icons-material/Assignment';

function LessonStatusIcon({ progress }: { progress: UnitProgress | undefined }) {
  switch (progress?.status) {
    case 'COMPLETED':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'LOCKED':
      return <LockIcon fontSize="small" color="disabled" />;
    case 'IN_PROGRESS':
      return <PlayCircleOutlineIcon fontSize="small" color="secondary" />;
    default:
      return <ArticleIcon fontSize="small" color="primary" />;
  }
}

export function CurriculumPage() {
  const { t } = useTranslation();
  const {
    data: path,
    isPending,
    isError,
  } = useQuery({
    queryKey: curriculumKeys.pathTree,
    queryFn: fetchPathTree,
  });
  const { data: progress } = useQuery({ queryKey: progressKeys.map, queryFn: fetchProgressMap });
  const { data: briefs } = useQuery({ queryKey: projectKeys.briefs, queryFn: fetchBriefSummaries });

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !path) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  const pct =
    progress && progress.totalLessons > 0
      ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
      : 0;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          {path.title}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          {path.description}
        </Typography>
      </Box>

      {progress ? (
        <Box sx={{ maxWidth: 560 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                variant="determinate"
                value={pct}
                aria-label={t('progress.pathProgress')}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {t('progress.lessonsDone', {
                done: progress.completedLessons,
                total: progress.totalLessons,
              })}
            </Typography>
            {progress.nextLessonId ? (
              <Button
                component={RouterLink}
                to={`/lessons/${progress.nextLessonId}`}
                size="small"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
              >
                {t('progress.continue')}
              </Button>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      <Box>
        {path.modules.map((module, index) => (
          <Accordion key={module.id} defaultExpanded={index === 0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {String(module.order).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>{module.title}</Typography>
                {progress?.modules[module.id]?.status === 'COMPLETED' ? (
                  <Chip size="small" color="success" label={t('progress.completed')} />
                ) : null}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: { xs: 'none', sm: 'block' } }}
                >
                  {module.description}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack spacing={2}>
                {module.topics.map((topic) => {
                  const readable = topic.lessons.filter((lesson) => lesson.isPublished);
                  const topicStatus = progress?.topics[topic.id]?.status;
                  return (
                    <Box key={topic.id}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {topic.title}
                        </Typography>
                        {readable.length === 0 ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<HourglassEmptyIcon />}
                            label={t('curriculum.comingSoon')}
                          />
                        ) : topicStatus === 'COMPLETED' ? (
                          <Chip size="small" color="success" label={t('progress.completed')} />
                        ) : topicStatus === 'LOCKED' ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<LockIcon />}
                            label={t('progress.locked')}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {topic.description}
                      </Typography>
                      {briefs?.some((b) => b.topicId === topic.id) ? (
                        <Button
                          component={RouterLink}
                          to={`/projects/topic/${topic.id}`}
                          size="small"
                          variant="outlined"
                          startIcon={<AssignmentIcon />}
                          disabled={topicStatus === 'LOCKED'}
                          sx={{ mb: 1 }}
                        >
                          {briefs.find((b) => b.topicId === topic.id)?.title}
                        </Button>
                      ) : null}
                      {readable.length > 0 ? (
                        <List dense disablePadding>
                          {readable.map((lesson) => {
                            const lessonProgress = progress?.lessons[lesson.id];
                            const locked = lessonProgress?.status === 'LOCKED';
                            return (
                              <ListItemButton
                                key={lesson.id}
                                component={RouterLink}
                                to={`/lessons/${lesson.id}`}
                                disabled={locked}
                                aria-disabled={locked}
                                sx={{ borderRadius: 1 }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <LessonStatusIcon progress={lessonProgress} />
                                </ListItemIcon>
                                <ListItemText
                                  primary={lesson.title}
                                  secondary={
                                    locked
                                      ? t('progress.lockedHint')
                                      : t('curriculum.minutes', { count: lesson.estimatedMinutes })
                                  }
                                />
                                {lessonProgress?.bestScorePct != null ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {t('progress.best', { pct: lessonProgress.bestScorePct })}
                                  </Typography>
                                ) : null}
                              </ListItemButton>
                            );
                          })}
                        </List>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Stack>
  );
}
