import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import { useTranslation } from 'react-i18next';
import { adaptiveKeys, fetchRevisions } from './api';

/**
 * Shows the learner's adaptive revision assignments. `variant="compact"` (used
 * on a lesson) shows only open items; the dashboard shows the full list.
 */
export function RevisionPanel({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { t } = useTranslation();
  const { data, isPending } = useQuery({
    queryKey: adaptiveKeys.revisions,
    queryFn: fetchRevisions,
    // Assignments change via side effects (quiz grading, lesson opening) the
    // panel can't observe, so always refetch when it mounts.
    refetchOnMount: 'always',
  });

  if (isPending || !data) return null;

  const open = data.filter((r) => r.status === 'ASSIGNED');
  const items = variant === 'compact' ? open : data;

  if (variant === 'compact' && open.length === 0) return null;
  if (items.length === 0) {
    return variant === 'full' ? (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <AutoStoriesIcon color="primary" />
          <Typography variant="h3" component="h2">
            {t('adaptive.title')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('adaptive.empty')}
        </Typography>
      </Paper>
    ) : null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="revision-panel">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <AutoStoriesIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h3" component="h2">
            {t('adaptive.title')}
          </Typography>
          {variant === 'full' ? (
            <Typography variant="body2" color="text.secondary">
              {t('adaptive.subtitle')}
            </Typography>
          ) : null}
        </Box>
        {open.length > 0 ? (
          <Chip size="small" color="warning" label={t('adaptive.openCount', { count: open.length })} />
        ) : null}
      </Stack>

      {open.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {t('adaptive.blockedNotice')}
        </Alert>
      ) : null}

      <List disablePadding>
        {items.map((r) => {
          const done = r.status === 'COMPLETED';
          return (
            <ListItem
              key={r.id}
              disableGutters
              secondaryAction={
                done ? (
                  <Chip size="small" color="success" label={t('adaptive.completed')} />
                ) : (
                  <Button
                    component={RouterLink}
                    to={`/lessons/${r.targetLessonId}`}
                    size="small"
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                  >
                    {t('adaptive.review')}
                  </Button>
                )
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {done ? (
                  <CheckCircleIcon color="success" fontSize="small" />
                ) : (
                  <AutoStoriesIcon color="warning" fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={t('adaptive.reviewSkill', {
                  skill: r.skillName,
                  lesson: r.targetLessonTitle,
                })}
                secondary={r.assessmentTitle}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
                sx={{ pr: 10 }}
              />
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
}
