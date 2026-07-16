import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import type { NotificationPreferences } from '@academy/shared';
import {
  fetchNotificationPreferences,
  notificationKeys,
  updateNotificationPreferences,
} from './api';

/** Compact opt-out toggles shown in the notification menu footer. */
export function NotificationSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: fetchNotificationPreferences,
    enabled: open,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => updateNotificationPreferences(patch),
    onSuccess: (next) => queryClient.setQueryData(notificationKeys.preferences, next),
  });

  const toggle = (key: keyof NotificationPreferences) => (checked: boolean) =>
    update.mutate({ [key]: checked });

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {t('notifications.settings')}
        </Typography>
        <Tooltip title={t('notifications.settings')}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label={t('notifications.settings')}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Collapse in={open}>
        <Stack sx={{ mt: 0.5 }}>
          <PrefSwitch
            label={t('notifications.prefPeerSuccess')}
            checked={data?.notifyPeerSuccess ?? true}
            onChange={toggle('notifyPeerSuccess')}
          />
          <PrefSwitch
            label={t('notifications.prefOvertaken')}
            checked={data?.notifyOvertaken ?? true}
            onChange={toggle('notifyOvertaken')}
          />
          <PrefSwitch
            label={t('notifications.prefEmailMilestones')}
            checked={data?.emailMilestones ?? true}
            onChange={toggle('emailMilestones')}
          />
        </Stack>
      </Collapse>
    </Box>
  );
}

function PrefSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      control={<Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label={<Typography variant="body2">{label}</Typography>}
      sx={{ m: 0, justifyContent: 'space-between', ml: 0 }}
      labelPlacement="start"
    />
  );
}
