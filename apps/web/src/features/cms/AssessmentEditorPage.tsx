import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';
import {
  AssessmentItemTypes,
  replaceItemsRequestSchema,
  type AssessmentItemType,
  type UpsertAssessmentRequest,
} from '@academy/shared';
import { ApiClientError } from '../../shared/api/client';
import { quizKeys } from '../quiz/api';
import {
  cmsKeys,
  fetchChallenges,
  fetchCmsLessons,
  fetchLessonAssessment,
  fetchSkills,
  replaceAssessmentItems,
  upsertLessonAssessment,
} from './api';
import {
  defaultQuizItem,
  nextQuizItemKey,
  QuizItemEditor,
  type EditableQuizItem,
} from './components/QuizItemEditor';

const DEFAULT_SETTINGS: UpsertAssessmentRequest = {
  title: '',
  passingScorePct: 70,
  maxAttempts: null,
  cooldownMinutes: 0,
  shuffleItems: false,
};

export function AssessmentEditorPage() {
  const { t } = useTranslation();
  const { lessonId = '' } = useParams();
  const queryClient = useQueryClient();

  const assessmentQuery = useQuery({
    queryKey: cmsKeys.assessment(lessonId),
    queryFn: () => fetchLessonAssessment(lessonId),
    enabled: lessonId.length > 0,
  });
  const skillsQuery = useQuery({ queryKey: cmsKeys.skills, queryFn: fetchSkills });
  const challengesQuery = useQuery({ queryKey: cmsKeys.challenges, queryFn: fetchChallenges });
  const lessonsQuery = useQuery({ queryKey: cmsKeys.lessons, queryFn: fetchCmsLessons });
  const lesson = useMemo(
    () => lessonsQuery.data?.find((l) => l.id === lessonId) ?? null,
    [lessonsQuery.data, lessonId],
  );

  const assessment = assessmentQuery.data ?? null;

  const [settings, setSettings] = useState<UpsertAssessmentRequest>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<EditableQuizItem[]>([]);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate local editor state from the server (when not mid-edit).
  useEffect(() => {
    if (!assessmentQuery.isSuccess) return;
    if (assessment && !settingsDirty) {
      setSettings({
        title: assessment.title,
        passingScorePct: assessment.passingScorePct,
        maxAttempts: assessment.maxAttempts,
        cooldownMinutes: assessment.cooldownMinutes,
        shuffleItems: assessment.shuffleItems,
      });
    }
    if (assessment && !itemsDirty) {
      setItems(
        assessment.items.map((item) => ({
          key: nextQuizItemKey(),
          points: item.points,
          skillIds: item.skillIds,
          item: item.item,
        })),
      );
    }
    if (!assessment && lesson && settings.title === '') {
      setSettings({
        ...DEFAULT_SETTINGS,
        title: t('cms.quiz.defaultTitle', { lesson: lesson.title }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentQuery.isSuccess, assessment?.id, assessment?.items.length]);

  const errorMessage = (err: unknown) =>
    err instanceof ApiClientError ? err.message : t('cms.actionFailed');

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: cmsKeys.assessment(lessonId) }),
      queryClient.invalidateQueries({ queryKey: quizKeys.summary(lessonId) }),
    ]);
  };

  const saveSettings = useMutation({
    mutationFn: () => upsertLessonAssessment(lessonId, settings),
    onSuccess: async () => {
      setError(null);
      setSettingsDirty(false);
      await invalidate();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const saveItems = useMutation({
    mutationFn: async () => {
      const request = replaceItemsRequestSchema.parse({
        items: items.map(({ points, skillIds, item }) => ({ points, skillIds, item })),
      });
      await replaceAssessmentItems(assessment!.id, request);
    },
    onSuccess: async () => {
      setError(null);
      setItemsDirty(false);
      await invalidate();
    },
    onError: (err) => {
      if (err && typeof err === 'object' && 'issues' in err) {
        setError(t('cms.quiz.itemsInvalid'));
      } else {
        setError(errorMessage(err));
      }
    },
  });

  if (assessmentQuery.isPending || lessonsQuery.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (assessmentQuery.isError || !lesson) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  const patchSettings = (patch: Partial<UpsertAssessmentRequest>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSettingsDirty(true);
  };

  const updateItem = (index: number, value: EditableQuizItem) => {
    setItems((prev) => prev.map((it, i) => (i === index ? value : it)));
    setItemsDirty(true);
  };
  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(index + direction, 0, moved!);
      return next;
    });
    setItemsDirty(true);
  };
  const deleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setItemsDirty(true);
  };
  const addItem = (type: AssessmentItemType) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextQuizItemKey(),
        points: type === 'REFLECTION' ? 4 : 2,
        skillIds: [],
        item: defaultQuizItem(type),
      },
    ]);
    setItemsDirty(true);
    setAddAnchor(null);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button
          component={RouterLink}
          to={`/instructor/lessons/${lessonId}`}
          startIcon={<ArrowBackIcon />}
        >
          {t('cms.quiz.backToLesson')}
        </Button>
        <Typography variant="h2" component="h1" sx={{ flexGrow: 1 }}>
          {t('cms.quiz.editorTitle', { lesson: lesson.title })}
        </Typography>
      </Stack>

      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h3" gutterBottom>
          {t('cms.quiz.settings')}
        </Typography>
        <Stack spacing={2.5} sx={{ maxWidth: 640 }}>
          <TextField
            label={t('cms.quiz.title')}
            value={settings.title}
            onChange={(e) => patchSettings({ title: e.target.value })}
            required
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('cms.quiz.passingScore')}
              type="number"
              value={settings.passingScorePct}
              onChange={(e) =>
                patchSettings({
                  passingScorePct: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
            <TextField
              label={t('cms.quiz.maxAttempts')}
              type="number"
              value={settings.maxAttempts ?? ''}
              placeholder={t('cms.quiz.unlimited')}
              onChange={(e) =>
                patchSettings({
                  maxAttempts: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                })
              }
            />
            <TextField
              label={t('cms.quiz.cooldown')}
              type="number"
              value={settings.cooldownMinutes}
              onChange={(e) =>
                patchSettings({ cooldownMinutes: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={settings.shuffleItems}
                onChange={(e) => patchSettings({ shuffleItems: e.target.checked })}
              />
            }
            label={t('cms.quiz.shuffle')}
          />
          <Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={
                (!settingsDirty && assessment !== null) ||
                saveSettings.isPending ||
                settings.title.trim().length < 3
              }
              onClick={() => saveSettings.mutate()}
            >
              {assessment ? t('cms.quiz.saveSettings') : t('cms.quiz.createQuiz')}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {assessment ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
            <Typography variant="h3" sx={{ flexGrow: 1 }}>
              {t('cms.quiz.questions', { count: items.length })}
            </Typography>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!itemsDirty || saveItems.isPending}
              onClick={() => saveItems.mutate()}
            >
              {itemsDirty ? t('cms.save') : t('cms.saved')}
            </Button>
          </Stack>

          <Stack spacing={2}>
            {items.map((item, index) => (
              <QuizItemEditor
                key={item.key}
                index={index}
                total={items.length}
                value={item}
                skillOptions={skillsQuery.data ?? []}
                challengeOptions={challengesQuery.data ?? []}
                onChange={(value) => updateItem(index, value)}
                onMove={(direction) => moveItem(index, direction)}
                onDelete={() => deleteItem(index)}
              />
            ))}
            <Box>
              <Button startIcon={<AddIcon />} onClick={(e) => setAddAnchor(e.currentTarget)}>
                {t('cms.quiz.addQuestion')}
              </Button>
              <Menu
                anchorEl={addAnchor}
                open={Boolean(addAnchor)}
                onClose={() => setAddAnchor(null)}
              >
                {AssessmentItemTypes.map((type) => (
                  <MenuItem key={type} onClick={() => addItem(type)}>
                    {t(`quiz.types.${type}`)}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Alert severity="info">{t('cms.quiz.createFirst')}</Alert>
      )}
    </Stack>
  );
}
