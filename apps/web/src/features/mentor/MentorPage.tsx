import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddCommentIcon from '@mui/icons-material/AddComment';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useTranslation } from 'react-i18next';
import { createConversation, fetchConversations, mentorKeys } from './api';
import { MentorChatPanel } from './components/MentorChatPanel';

export function MentorPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: conversations, isPending } = useQuery({
    queryKey: mentorKeys.conversations,
    queryFn: fetchConversations,
  });

  // Select the most recent conversation once the list arrives.
  useEffect(() => {
    if (activeId == null && conversations && conversations.length > 0) {
      setActiveId(conversations[0]!.id);
    }
  }, [conversations, activeId]);

  const newChat = useMutation({
    mutationFn: () => createConversation(),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: mentorKeys.conversations });
      setActiveId(id);
    },
  });

  return (
    <Stack spacing={3} sx={{ height: 'calc(100vh - 180px)' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <SmartToyIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h1">{t('mentor.title')}</Typography>
          <Typography color="text.secondary">{t('mentor.subtitle')}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCommentIcon />}
          disabled={newChat.isPending}
          onClick={() => newChat.mutate()}
        >
          {t('mentor.newChat')}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0, overflowY: 'auto', maxHeight: '100%' }}
        >
          {isPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} aria-busy="true">
              <CircularProgress size={24} />
            </Box>
          ) : conversations && conversations.length > 0 ? (
            <List disablePadding>
              {conversations.map((c) => (
                <ListItemButton
                  key={c.id}
                  selected={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                >
                  <ListItemText
                    primary={c.title}
                    secondary={c.lessonTitle ?? undefined}
                    primaryTypographyProps={{ noWrap: true }}
                    secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('mentor.noConversations')}
              </Typography>
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ flexGrow: 1, p: 2, minHeight: 0, display: 'flex' }}>
          {activeId ? (
            <MentorChatPanel conversationId={activeId} />
          ) : (
            <Alert severity="info" sx={{ m: 'auto' }}>
              {t('mentor.startPrompt')}
            </Alert>
          )}
        </Paper>
      </Stack>
    </Stack>
  );
}
