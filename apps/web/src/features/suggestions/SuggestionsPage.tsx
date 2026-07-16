import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useTranslation } from 'react-i18next';
import type { CreateSuggestionRequest, SuggestionStatus } from '@academy/shared';
import { curriculumKeys, fetchPathTree } from '../curriculum/api';
import { fetchMySuggestions, submitSuggestion, suggestionKeys } from './api';

const statusColor: Record<SuggestionStatus, 'default' | 'success' | 'error'> = {
  PENDING: 'default',
  ACCEPTED: 'success',
  REJECTED: 'error',
};

interface DraftOption {
  id: string;
  text: string;
}

export function SuggestionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<'IDEA' | 'DRAFT_QUESTION'>('IDEA');
  const [lessonId, setLessonId] = useState('');
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<DraftOption[]>([
    { id: 'a', text: '' },
    { id: 'b', text: '' },
  ]);
  const [correctId, setCorrectId] = useState('a');

  const { data: path } = useQuery({ queryKey: curriculumKeys.pathTree, queryFn: fetchPathTree });
  const { data: mine } = useQuery({ queryKey: suggestionKeys.mine, queryFn: fetchMySuggestions });

  const lessons = useMemo(
    () =>
      (path?.modules ?? []).flatMap((m) =>
        m.topics.flatMap((topic) =>
          topic.lessons.filter((l) => l.isPublished).map((l) => ({ id: l.id, title: l.title })),
        ),
      ),
    [path],
  );

  const submit = useMutation({
    mutationFn: (request: CreateSuggestionRequest) => submitSuggestion(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suggestionKeys.mine });
      setBody('');
      setPrompt('');
      setOptions([
        { id: 'a', text: '' },
        { id: 'b', text: '' },
      ]);
      setCorrectId('a');
    },
  });

  const draftValid =
    kind === 'IDEA'
      ? body.trim().length >= 10
      : lessonId !== '' &&
        prompt.trim().length > 0 &&
        options.filter((o) => o.text.trim()).length >= 2 &&
        options.some((o) => o.id === correctId && o.text.trim());

  const onSubmit = () => {
    if (kind === 'IDEA') {
      submit.mutate({ kind: 'IDEA', lessonId: lessonId || undefined, body: body.trim() });
    } else {
      submit.mutate({
        kind: 'DRAFT_QUESTION',
        lessonId,
        body: body.trim(),
        draft: {
          points: 2,
          skillIds: [],
          item: {
            type: 'MCQ',
            payload: {
              prompt: prompt.trim(),
              options: options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim() })),
              correctOptionId: correctId,
            },
          },
        },
      });
    }
  };

  const addOption = () => {
    const nextId = String.fromCharCode(97 + options.length); // a, b, c…
    if (options.length < 6) setOptions([...options, { id: nextId, text: '' }]);
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 820, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <LightbulbIcon color="primary" />
        <Box>
          <Typography variant="h1">{t('suggest.title')}</Typography>
          <Typography color="text.secondary">{t('suggest.subtitle')}</Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3 }} component="section">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={kind}
          onChange={(_e, v) => v && setKind(v)}
          sx={{ mb: 2 }}
          aria-label={t('suggest.kind')}
        >
          <ToggleButton value="IDEA">{t('suggest.idea')}</ToggleButton>
          <ToggleButton value="DRAFT_QUESTION">{t('suggest.draftQuestion')}</ToggleButton>
        </ToggleButtonGroup>

        <Stack spacing={2}>
          <TextField
            select
            label={kind === 'DRAFT_QUESTION' ? t('suggest.lessonRequired') : t('suggest.lessonOptional')}
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            fullWidth
            size="small"
            required={kind === 'DRAFT_QUESTION'}
          >
            <MenuItem value="">
              <em>{t('suggest.noLesson')}</em>
            </MenuItem>
            {lessons.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.title}
              </MenuItem>
            ))}
          </TextField>

          {kind === 'DRAFT_QUESTION' ? (
            <>
              <TextField
                label={t('suggest.questionPrompt')}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ 'data-testid': 'suggest-prompt' }}
              />
              <RadioGroup value={correctId} onChange={(e) => setCorrectId(e.target.value)}>
                <Typography variant="body2" color="text.secondary">
                  {t('suggest.optionsHint')}
                </Typography>
                {options.map((option, index) => (
                  <Stack key={option.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <FormControlLabel
                      value={option.id}
                      control={<Radio size="small" />}
                      label=""
                      sx={{ mr: 0 }}
                      aria-label={t('suggest.markCorrect', { n: index + 1 })}
                    />
                    <TextField
                      value={option.text}
                      onChange={(e) =>
                        setOptions(options.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o)))
                      }
                      placeholder={t('suggest.optionN', { n: index + 1 })}
                      size="small"
                      fullWidth
                    />
                    {options.length > 2 ? (
                      <IconButton
                        aria-label={t('common.cancel')}
                        onClick={() => setOptions(options.filter((o) => o.id !== option.id))}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                ))}
              </RadioGroup>
              {options.length < 6 ? (
                <Button startIcon={<AddIcon />} size="small" onClick={addOption} sx={{ alignSelf: 'flex-start' }}>
                  {t('suggest.addOption')}
                </Button>
              ) : null}
            </>
          ) : null}

          <TextField
            label={kind === 'IDEA' ? t('suggest.ideaBody') : t('suggest.rationale')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            minRows={kind === 'IDEA' ? 3 : 2}
            inputProps={{ 'data-testid': 'suggest-body' }}
          />

          {submit.isError ? <Alert severity="error">{t('suggest.submitFailed')}</Alert> : null}
          {submit.isSuccess ? <Alert severity="success">{t('suggest.submitted')}</Alert> : null}

          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={!draftValid || submit.isPending}
            sx={{ alignSelf: 'flex-start' }}
            data-testid="suggest-submit"
          >
            {t('suggest.submit')}
          </Button>
        </Stack>
      </Paper>

      <Box>
        <Typography variant="h3" component="h2" gutterBottom>
          {t('suggest.mine')}
        </Typography>
        {(mine ?? []).length === 0 ? (
          <Typography color="text.secondary">{t('suggest.mineEmpty')}</Typography>
        ) : (
          <Stack spacing={1.5}>
            {(mine ?? []).map((s) => (
              <Paper key={s.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Chip size="small" label={t(`suggest.status.${s.status}`)} color={statusColor[s.status]} />
                  <Typography variant="body2" color="text.secondary">
                    {s.kind === 'DRAFT_QUESTION' ? t('suggest.draftQuestion') : t('suggest.idea')}
                    {s.lessonTitle ? ` · ${s.lessonTitle}` : ''}
                  </Typography>
                </Stack>
                {s.body ? <Typography variant="body2">{s.body}</Typography> : null}
                {s.adminNote ? (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      {t('suggest.reviewerNote')}: {s.adminNote}
                    </Typography>
                  </>
                ) : null}
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
