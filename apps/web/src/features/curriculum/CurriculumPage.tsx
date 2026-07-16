import { useQuery } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { curriculumKeys, fetchPathTree } from './api';

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

      <Box>
        {path.modules.map((module, index) => (
          <Accordion key={module.id} defaultExpanded={index === 0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
                <Typography color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {String(module.order).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>{module.title}</Typography>
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
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {topic.description}
                      </Typography>
                      {readable.length > 0 ? (
                        <List dense disablePadding>
                          {readable.map((lesson) => (
                            <ListItemButton
                              key={lesson.id}
                              component={RouterLink}
                              to={`/lessons/${lesson.id}`}
                              sx={{ borderRadius: 1 }}
                            >
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <ArticleIcon fontSize="small" color="primary" />
                              </ListItemIcon>
                              <ListItemText
                                primary={lesson.title}
                                secondary={t('curriculum.minutes', {
                                  count: lesson.estimatedMinutes,
                                })}
                              />
                            </ListItemButton>
                          ))}
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
