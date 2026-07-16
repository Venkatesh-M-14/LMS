import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ForumIcon from '@mui/icons-material/Forum';
import { useTranslation } from 'react-i18next';
import { fetchLessonChannel } from './api';
import { ChatPanel } from './ChatPanel';

/** The per-lesson discussion thread, shown at the foot of a lesson. */
export function LessonDiscussion({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();
  const { data: channel, isPending } = useQuery({
    queryKey: ['chat', 'lesson-channel', lessonId],
    queryFn: () => fetchLessonChannel(lessonId),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <ForumIcon color="primary" />
        <Typography variant="h3" component="h2">
          {t('chat.lessonDiscussion')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('chat.lessonDiscussionHint')}
      </Typography>
      {isPending || !channel ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} aria-busy="true">
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ height: 360 }}>
          <ChatPanel channelId={channel.id} emptyHint={t('chat.lessonDiscussionEmpty')} />
        </Box>
      )}
    </Paper>
  );
}
