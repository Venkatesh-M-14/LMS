import { useState, type MouseEvent, type ReactElement } from 'react';
import { Link as RouterLink, Outlet, useNavigate } from 'react-router';
import Button from '@mui/material/Button';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import SchoolIcon from '@mui/icons-material/School';
import TranslateIcon from '@mui/icons-material/Translate';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckIcon from '@mui/icons-material/Check';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import Divider from '@mui/material/Divider';
import { useTranslation } from 'react-i18next';
import { StatsBadge } from '../../features/gamification/components/StatsBadge';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { themeModeChanged, type ThemeMode } from '../../app/uiSlice';
import { loggedOut } from '../../features/auth/authSlice';
import { logoutUser } from '../../features/auth/api';
import { SUPPORTED_LOCALES } from '../../app/i18n';
import { queryClient } from '../../app/queryClient';
import { useRealtime } from '../realtime/useRealtime';

const THEME_OPTIONS: Array<{ mode: ThemeMode; labelKey: string; icon: ReactElement }> = [
  { mode: 'light', labelKey: 'nav.themeLight', icon: <LightModeIcon fontSize="small" /> },
  { mode: 'dark', labelKey: 'nav.themeDark', icon: <DarkModeIcon fontSize="small" /> },
  {
    mode: 'system',
    labelKey: 'nav.themeSystem',
    icon: <SettingsBrightnessIcon fontSize="small" />,
  },
];

export function AppLayout() {
  useRealtime();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const user = useAppSelector((state) => state.auth.user);

  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const [langAnchor, setLangAnchor] = useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null);

  const openMenu = (setter: (el: HTMLElement | null) => void) => (event: MouseEvent<HTMLElement>) =>
    setter(event.currentTarget);

  const handleLogout = async () => {
    setUserAnchor(null);
    await logoutUser();
    queryClient.clear();
    dispatch(loggedOut());
    navigate('/login');
  };

  const activeThemeIcon =
    themeMode === 'light' ? (
      <LightModeIcon />
    ) : themeMode === 'dark' ? (
      <DarkModeIcon />
    ) : (
      <SettingsBrightnessIcon />
    );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="default"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <SchoolIcon color="primary" aria-hidden />
          <Typography
            variant="h6"
            component="span"
            sx={{ fontWeight: 700, display: { xs: 'none', md: 'block' } }}
          >
            {t('app.name')}
          </Typography>

          <Box component="nav" sx={{ display: 'flex', gap: 0.5, ml: 2, flexGrow: 1 }}>
            <Button component={RouterLink} to="/" color="inherit" size="small">
              {t('nav.dashboard')}
            </Button>
            <Button component={RouterLink} to="/curriculum" color="inherit" size="small">
              {t('nav.curriculum')}
            </Button>
            <Button component={RouterLink} to="/mentor" color="inherit" size="small">
              {t('nav.mentor')}
            </Button>
            {user && (user.role === 'INSTRUCTOR' || user.role === 'ADMIN') ? (
              <>
                <Button component={RouterLink} to="/instructor" color="inherit" size="small">
                  {t('nav.instructor')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/instructor/grading"
                  color="inherit"
                  size="small"
                >
                  {t('nav.grading')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/instructor/projects"
                  color="inherit"
                  size="small"
                >
                  {t('nav.projects')}
                </Button>
              </>
            ) : null}
          </Box>

          <StatsBadge />

          <Tooltip title={t('nav.theme')}>
            <IconButton aria-label={t('nav.theme')} onClick={openMenu(setThemeAnchor)}>
              {activeThemeIcon}
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={themeAnchor}
            open={Boolean(themeAnchor)}
            onClose={() => setThemeAnchor(null)}
          >
            {THEME_OPTIONS.map((option) => (
              <MenuItem
                key={option.mode}
                selected={themeMode === option.mode}
                onClick={() => {
                  dispatch(themeModeChanged(option.mode));
                  setThemeAnchor(null);
                }}
              >
                <ListItemIcon>{option.icon}</ListItemIcon>
                <ListItemText>{t(option.labelKey)}</ListItemText>
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title={t('nav.language')}>
            <IconButton aria-label={t('nav.language')} onClick={openMenu(setLangAnchor)}>
              <TranslateIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={langAnchor}
            open={Boolean(langAnchor)}
            onClose={() => setLangAnchor(null)}
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <MenuItem
                key={locale.code}
                selected={i18n.resolvedLanguage === locale.code}
                onClick={() => {
                  void i18n.changeLanguage(locale.code);
                  setLangAnchor(null);
                }}
              >
                <ListItemIcon>
                  {i18n.resolvedLanguage === locale.code ? <CheckIcon fontSize="small" /> : null}
                </ListItemIcon>
                <ListItemText>{locale.label}</ListItemText>
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title={user?.displayName ?? ''}>
            <IconButton
              aria-label={user?.displayName ?? 'account'}
              onClick={openMenu(setUserAnchor)}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}>
                {(user?.displayName ?? '?').slice(0, 1).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={userAnchor}
            open={Boolean(userAnchor)}
            onClose={() => setUserAnchor(null)}
          >
            <MenuItem component={RouterLink} to="/achievements" onClick={() => setUserAnchor(null)}>
              <ListItemIcon>
                <EmojiEventsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('nav.achievements')}</ListItemText>
            </MenuItem>
            <MenuItem component={RouterLink} to="/leaderboard" onClick={() => setUserAnchor(null)}>
              <ListItemIcon>
                <LeaderboardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('nav.leaderboard')}</ListItemText>
            </MenuItem>
            <MenuItem component={RouterLink} to="/certificates" onClick={() => setUserAnchor(null)}>
              <ListItemIcon>
                <WorkspacePremiumIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('nav.certificates')}</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => void handleLogout()}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('nav.logout')}</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
