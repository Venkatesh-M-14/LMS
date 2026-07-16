import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../app/hooks';
import { chatKeys, fetchMessages, markChannelRead, sendMessage } from './api';

const MAX = 2000;

/** Message transcript + composer for one channel. Height is driven by the parent. */
export function ChatPanel({ channelId, emptyHint }: { channelId: string; emptyHint?: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isPending } = useQuery({
    queryKey: chatKeys.messages(channelId),
    queryFn: () => fetchMessages(channelId),
  });
  const messages = data?.messages ?? [];

  // Opening/refreshing a channel clears its unread badge in the sidebar.
  useEffect(() => {
    void markChannelRead(channelId).then(() =>
      queryClient.invalidateQueries({ queryKey: chatKeys.channels }),
    );
  }, [channelId, data, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(channelId, body),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.channels });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body && !send.isPending) send.mutate(body);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const body = draft.trim();
      if (body && !send.isPending) send.mutate(body);
    }
  };

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box
        ref={scrollRef}
        sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}
      >
        {isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} aria-busy="true">
            <CircularProgress size={24} />
          </Box>
        ) : messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            {emptyHint ?? t('chat.empty')}
          </Typography>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === currentUserId;
            return (
              <Box
                key={m.id}
                sx={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: mine ? 'primary.main' : 'action.hover',
                  color: mine ? 'primary.contrastText' : 'text.primary',
                }}
              >
                {!mine ? (
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                    {m.authorName}
                  </Typography>
                ) : null}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.body}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', textAlign: 'right' }}>
                  {time(m.createdAt)}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>

      <Box component="form" onSubmit={submit} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
            onKeyDown={onKeyDown}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            inputProps={{ 'data-testid': 'chat-composer' }}
          />
          <IconButton
            type="submit"
            color="primary"
            disabled={send.isPending || draft.trim().length === 0}
            aria-label={t('chat.send')}
            data-testid="chat-send"
          >
            {send.isPending ? <CircularProgress size={20} /> : <SendIcon />}
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
