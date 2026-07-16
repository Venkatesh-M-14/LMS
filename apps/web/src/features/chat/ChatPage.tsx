import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ForumIcon from '@mui/icons-material/Forum';
import { useTranslation } from 'react-i18next';
import type { ChatChannelView } from '@academy/shared';
import {
  chatKeys,
  fetchChannels,
  fetchGroupChannel,
  fetchPeers,
  startDirectChannel,
} from './api';
import { ChatPanel } from './ChatPanel';

export function ChatPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: channels } = useQuery({ queryKey: chatKeys.channels, queryFn: fetchChannels });
  const { data: peers } = useQuery({ queryKey: chatKeys.peers, queryFn: fetchPeers });
  // Ensure the group room exists and is selected by default.
  const { data: group } = useQuery({ queryKey: ['chat', 'group'], queryFn: fetchGroupChannel });

  useEffect(() => {
    if (activeId == null && group) setActiveId(group.id);
  }, [group, activeId]);

  const startDm = useMutation({
    mutationFn: (userId: string) => startDirectChannel(userId),
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: chatKeys.channels });
      setActiveId(channel.id);
    },
  });

  const { rooms, dms } = useMemo(() => {
    const list = channels ?? [];
    return {
      rooms: list.filter((c) => c.type !== 'DIRECT'),
      dms: list.filter((c) => c.type === 'DIRECT'),
    };
  }, [channels]);

  // Peers you don't yet have a DM with — offered in the "start a chat" picker.
  const dmPeerNames = new Set(dms.map((d) => d.title));
  const startablePeers = (peers ?? []).filter((p) => !dmPeerNames.has(p.displayName));

  const active = (channels ?? []).find((c) => c.id === activeId) ?? group ?? null;

  return (
    <Stack spacing={3} sx={{ height: 'calc(100vh - 180px)' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <ForumIcon color="primary" />
        <Box>
          <Typography variant="h1">{t('chat.title')}</Typography>
          <Typography color="text.secondary">{t('chat.subtitle')}</Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0, overflowY: 'auto', maxHeight: '100%' }}
        >
          <List
            dense
            subheader={<ListSubheader disableSticky>{t('chat.rooms')}</ListSubheader>}
          >
            {rooms.map((c) => (
              <ChannelRow key={c.id} channel={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
            ))}
          </List>
          <Divider />
          <List dense subheader={<ListSubheader disableSticky>{t('chat.directMessages')}</ListSubheader>}>
            {dms.map((c) => (
              <ChannelRow key={c.id} channel={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
            ))}
            {dms.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                {t('chat.noDms')}
              </Typography>
            ) : null}
          </List>
          {startablePeers.length > 0 ? (
            <Box sx={{ p: 1 }}>
              <TextField
                select
                fullWidth
                size="small"
                label={t('chat.startDm')}
                value=""
                onChange={(e) => e.target.value && startDm.mutate(e.target.value)}
              >
                {startablePeers.map((p) => (
                  <MenuItem key={p.userId} value={p.userId}>
                    {p.displayName}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          ) : null}
        </Paper>

        <Paper variant="outlined" sx={{ flexGrow: 1, p: 2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {active ? (
            <>
              <Typography variant="h3" component="h2" sx={{ mb: 1 }}>
                {active.title}
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                <ChatPanel channelId={active.id} />
              </Box>
            </>
          ) : null}
        </Paper>
      </Stack>
    </Stack>
  );
}

function ChannelRow({
  channel,
  active,
  onClick,
}: {
  channel: ChatChannelView;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <ListItemButton selected={active} onClick={onClick}>
      <ListItemText
        primary={channel.title}
        secondary={channel.lastMessagePreview ?? undefined}
        primaryTypographyProps={{ noWrap: true }}
        secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
      />
      {channel.unreadCount > 0 ? <Badge color="error" badgeContent={channel.unreadCount} /> : null}
    </ListItemButton>
  );
}
