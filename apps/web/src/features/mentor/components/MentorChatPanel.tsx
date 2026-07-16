import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useTranslation } from 'react-i18next';
import { fetchMentorBudget, mentorKeys } from '../api';
import { useMentorChat } from '../useMentorChat';

const MAX_MESSAGE = 4000;

function Bubble({ role, children }: { role: 'USER' | 'ASSISTANT'; children: React.ReactNode }) {
  const isUser = role === 'USER';
  return (
    <Box
      sx={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        px: 1.75,
        py: 1.25,
        borderRadius: 2,
        bgcolor: isUser ? 'primary.main' : 'action.hover',
        color: isUser ? 'primary.contrastText' : 'text.primary',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}

/**
 * A self-contained mentor chat surface: budget bar, scrolling transcript with
 * live streaming, and a composer. Shared by the full page and the lesson drawer.
 */
export function MentorChatPanel({
  conversationId,
  emptyHint,
}: {
  conversationId: string | null;
  emptyHint?: string;
}) {
  const { t } = useTranslation();
  const { data: budget } = useQuery({ queryKey: mentorKeys.budget, queryFn: fetchMentorBudget });
  const { messages, streaming, isStreaming, error, loadingHistory, send } =
    useMentorChat(conversationId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const notConfigured = budget && !budget.configured;
  const budgetExhausted = budget?.configured && budget.remaining <= 0;
  const usedPct =
    budget && budget.dailyTokenBudget > 0
      ? Math.min(100, Math.round((budget.tokensUsedToday / budget.dailyTokenBudget) * 100))
      : 0;

  const canSend =
    conversationId != null &&
    !isStreaming &&
    draft.trim().length > 0 &&
    !notConfigured &&
    !budgetExhausted;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    send(draft);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        send(draft);
        setDraft('');
      }
    }
  };

  const errorMessage =
    error === 'MENTOR_BUDGET_EXCEEDED'
      ? t('mentor.budgetExceeded')
      : error === 'MENTOR_NOT_CONFIGURED'
        ? t('mentor.notConfigured')
        : error === 'load'
          ? t('mentor.loadError')
          : error
            ? t('mentor.streamError')
            : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {budget?.configured ? (
        <Box sx={{ px: 0.5, pb: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('mentor.budgetLabel')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('mentor.tokensRemaining', { count: budget.remaining })}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={usedPct}
            color={usedPct > 90 ? 'warning' : 'primary'}
            sx={{ borderRadius: 1 }}
          />
        </Box>
      ) : null}

      <Box
        ref={scrollRef}
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          py: 1,
        }}
      >
        {loadingHistory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} aria-busy="true">
            <CircularProgress size={24} />
          </Box>
        ) : null}

        {!loadingHistory && messages.length === 0 && !streaming ? (
          <Stack sx={{ alignItems: 'center', textAlign: 'center', color: 'text.secondary', py: 4 }}>
            <SmartToyIcon sx={{ fontSize: 40, mb: 1, opacity: 0.6 }} />
            <Typography variant="body2">{emptyHint ?? t('mentor.emptyHint')}</Typography>
          </Stack>
        ) : null}

        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}>
            {m.content}
          </Bubble>
        ))}

        {streaming != null ? (
          <Bubble role="ASSISTANT">
            {streaming}
            {streaming.length === 0 ? <CircularProgress size={12} sx={{ ml: 0.5 }} /> : null}
          </Bubble>
        ) : null}
      </Box>

      {notConfigured ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          {t('mentor.notConfigured')}
        </Alert>
      ) : null}
      {budgetExhausted && !notConfigured ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t('mentor.budgetExceeded')}
        </Alert>
      ) : null}
      {errorMessage && !notConfigured && !budgetExhausted ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorMessage}
        </Alert>
      ) : null}

      <Box component="form" onSubmit={submit} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={5}
            size="small"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE))}
            onKeyDown={onKeyDown}
            placeholder={t('mentor.composerPlaceholder')}
            disabled={notConfigured || budgetExhausted || conversationId == null}
            aria-label={t('mentor.composerPlaceholder')}
            inputProps={{ 'data-testid': 'mentor-composer' }}
          />
          <Tooltip title={t('mentor.send')}>
            <span>
              <IconButton
                type="submit"
                color="primary"
                disabled={!canSend}
                aria-label={t('mentor.send')}
                data-testid="mentor-send"
              >
                {isStreaming ? <CircularProgress size={20} /> : <SendIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}
