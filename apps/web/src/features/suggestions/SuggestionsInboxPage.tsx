import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import InboxIcon from '@mui/icons-material/Inbox';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { SuggestionStatus, SuggestionView } from '@academy/shared';
import { fetchSuggestionInbox, reviewSuggestion, suggestionKeys } from './api';

type Filter = SuggestionStatus | 'ALL';

export function SuggestionsInboxPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const { data, isPending } = useQuery({
    queryKey: suggestionKeys.inbox(filter),
    queryFn: () => fetchSuggestionInbox(filter),
  });

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <InboxIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h1">{t('inbox.title')}</Typography>
          <Typography color="text.secondary">{t('inbox.subtitle')}</Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_e, v) => v && setFilter(v)}
          aria-label={t('inbox.filter')}
        >
          <ToggleButton value="PENDING">{t('suggest.status.PENDING')}</ToggleButton>
          <ToggleButton value="ACCEPTED">{t('suggest.status.ACCEPTED')}</ToggleButton>
          <ToggleButton value="REJECTED">{t('suggest.status.REJECTED')}</ToggleButton>
          <ToggleButton value="ALL">{t('inbox.all')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} aria-busy="true">
          <CircularProgress />
        </Box>
      ) : (data ?? []).length === 0 ? (
        <Alert severity="info">{t('inbox.empty')}</Alert>
      ) : (
        <Stack spacing={2}>
          {(data ?? []).map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function SuggestionCard({ suggestion }: { suggestion: SuggestionView }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const review = useMutation({
    mutationFn: (decision: 'ACCEPT' | 'REJECT') =>
      reviewSuggestion(suggestion.id, { decision, adminNote: note || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions', 'inbox'] }),
  });

  const draft = suggestion.draft as
    | { item?: { type?: string; payload?: { prompt?: string; options?: Array<{ id: string; text: string }>; correctOptionId?: string } } }
    | null;
  const pending = suggestion.status === 'PENDING';

  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="suggestion-card">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          label={suggestion.kind === 'DRAFT_QUESTION' ? t('suggest.draftQuestion') : t('suggest.idea')}
          color={suggestion.kind === 'DRAFT_QUESTION' ? 'secondary' : 'default'}
        />
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {t('inbox.by', { name: suggestion.authorName })}
          {suggestion.lessonTitle ? ` · ${suggestion.lessonTitle}` : ''}
        </Typography>
        {!pending ? (
          <Chip
            size="small"
            color={suggestion.status === 'ACCEPTED' ? 'success' : 'error'}
            label={t(`suggest.status.${suggestion.status}`)}
          />
        ) : null}
      </Stack>

      {suggestion.body ? <Typography variant="body2" sx={{ mb: 1 }}>{suggestion.body}</Typography> : null}

      {draft?.item?.payload ? (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {draft.item.payload.prompt}
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {(draft.item.payload.options ?? []).map((o) => (
              <Typography
                key={o.id}
                variant="body2"
                color={o.id === draft.item?.payload?.correctOptionId ? 'success.main' : 'text.secondary'}
              >
                {o.id === draft.item?.payload?.correctOptionId ? '✓ ' : '• '}
                {o.text}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      {pending ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
            <TextField
              size="small"
              placeholder={t('inbox.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckIcon />}
              disabled={review.isPending}
              onClick={() => review.mutate('ACCEPT')}
              data-testid="suggestion-accept"
            >
              {suggestion.kind === 'DRAFT_QUESTION' ? t('inbox.acceptAndAdd') : t('inbox.accept')}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<CloseIcon />}
              disabled={review.isPending}
              onClick={() => review.mutate('REJECT')}
            >
              {t('inbox.reject')}
            </Button>
          </Stack>
          {review.isError ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {t('inbox.reviewFailed')}
            </Alert>
          ) : null}
        </>
      ) : suggestion.adminNote ? (
        <Typography variant="caption" color="text.secondary">
          {t('suggest.reviewerNote')}: {suggestion.adminNote}
        </Typography>
      ) : null}
    </Paper>
  );
}
