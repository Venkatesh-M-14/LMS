import { useState, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import NotificationsIcon from '@mui/icons-material/Notifications';
import type { NotificationView } from '@academy/shared';
import { useTranslation } from 'react-i18next';
import { fetchNotifications, markNotificationsRead, notificationKeys } from './api';

function relativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const { data } = useQuery({
    queryKey: notificationKeys.list,
    queryFn: fetchNotifications,
    // The socket invalidates on push; poll as a fallback for missed sockets.
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
  });

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  const open = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const close = () => setAnchor(null);

  const onItemClick = (n: NotificationView) => {
    if (!n.read) markRead.mutate([n.id]);
    close();
    if (n.linkUrl) navigate(n.linkUrl);
  };

  return (
    <>
      <Tooltip title={t('notifications.title')}>
        <IconButton
          aria-label={t('notifications.ariaLabel', { count: unread })}
          onClick={open}
          data-testid="notification-bell"
        >
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        slotProps={{ paper: { sx: { width: 360, maxWidth: '100%' } } }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}
        >
          <Typography variant="subtitle2">{t('notifications.title')}</Typography>
          {unread > 0 ? (
            <Button size="small" onClick={() => markRead.mutate(undefined)}>
              {t('notifications.markAllRead')}
            </Button>
          ) : null}
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 3 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              {t('notifications.empty')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {items.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => onItemClick(n)}
                sx={{
                  bgcolor: n.read ? 'transparent' : 'action.hover',
                  alignItems: 'flex-start',
                }}
              >
                <ListItemText
                  primary={n.title}
                  secondary={
                    <>
                      {n.body}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {relativeTime(n.createdAt, i18n.resolvedLanguage ?? 'en')}
                      </Typography>
                    </>
                  }
                  primaryTypographyProps={{ variant: 'body2', fontWeight: n.read ? 400 : 600 }}
                  secondaryTypographyProps={{ variant: 'body2', component: 'span' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Menu>
    </>
  );
}
