import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { createConversation, mentorKeys } from './api';
import { MentorChatPanel } from './components/MentorChatPanel';

/**
 * A floating "Ask the mentor" button on a lesson. Opening it lazily creates a
 * conversation grounded in this lesson (published content only — never answer
 * keys or hidden tests).
 */
export function LessonMentorDrawer({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => createConversation(lessonId),
    onSuccess: ({ id }) => {
      setConversationId(id);
      void queryClient.invalidateQueries({ queryKey: mentorKeys.conversations });
    },
  });

  const handleOpen = () => {
    setOpen(true);
    if (!conversationId && !start.isPending) start.mutate();
  };

  return (
    <>
      <Fab
        color="primary"
        variant="extended"
        onClick={handleOpen}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: (theme) => theme.zIndex.speedDial }}
        data-testid="mentor-fab"
      >
        <SmartToyIcon sx={{ mr: 1 }} />
        {t('mentor.askMentor')}
      </Fab>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, p: 2 } }}
      >
        <Stack sx={{ height: '100%', minHeight: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <SmartToyIcon color="primary" />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h3" component="h2" noWrap>
                {t('mentor.askMentor')}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {lessonTitle}
              </Typography>
            </Box>
            <IconButton aria-label={t('common.cancel')} onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {start.isPending && !conversationId ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} aria-busy="true">
                <CircularProgress />
              </Box>
            ) : (
              <MentorChatPanel
                conversationId={conversationId}
                emptyHint={t('mentor.lessonEmptyHint')}
              />
            )}
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
