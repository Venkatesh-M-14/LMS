import { useState, type MouseEvent, type ReactElement } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router';
import Button from '@mui/material/Button';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListSubheader from '@mui/material/ListSubheader';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import MenuIcon from '@mui/icons-material/Menu';
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
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ForumIcon from '@mui/icons-material/Forum';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import InsightsIcon from '@mui/icons-material/Insights';
import InboxIcon from '@mui/icons-material/Inbox';
import Divider from '@mui/material/Divider';
import { useTranslation } from 'react-i18next';
import { StatsBadge } from '../../features/gamification/components/StatsBadge';
import { NotificationBell } from '../../features/notifications/NotificationBell';
import { usePageViews } from '../analytics/usePageViews';
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

interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactElement;
}

const MAIN_NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: <SpaceDashboardIcon fontSize="small" /> },
  { to: '/curriculum', labelKey: 'nav.curriculum', icon: <MenuBookIcon fontSize="small" /> },
  { to: '/mentor', labelKey: 'nav.mentor', icon: <PsychologyIcon fontSize="small" /> },
  { to: '/chat', labelKey: 'nav.chat', icon: <ForumIcon fontSize="small" /> },
];

const INSTRUCTOR_NAV: NavItem[] = [
  { to: '/instructor', labelKey: 'nav.instructor', icon: <HistoryEduIcon fontSize="small" /> },
  {
    to: '/instructor/grading',
    labelKey: 'nav.grading',
    icon: <FactCheckIcon fontSize="small" />,
  },
  {
    to: '/instructor/projects',
    labelKey: 'nav.projects',
    icon: <AssignmentTurnedInIcon fontSize="small" />,
  },
  {
    to: '/instructor/analytics',
    labelKey: 'nav.analytics',
    icon: <InsightsIcon fontSize="small" />,
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    to: '/instructor/suggestions',
    labelKey: 'nav.suggestions',
    icon: <InboxIcon fontSize="small" />,
  },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/achievements', labelKey: 'nav.achievements', icon: <EmojiEventsIcon fontSize="small" /> },
  { to: '/leaderboard', labelKey: 'nav.leaderboard', icon: <LeaderboardIcon fontSize="small" /> },
  {
    to: '/certificates',
    labelKey: 'nav.certificates',
    icon: <WorkspacePremiumIcon fontSize="small" />,
  },
  {
    to: '/suggestions',
    labelKey: 'nav.suggestQuestion',
    icon: <LightbulbIcon fontSize="small" />,
  },
];

export function AppLayout() {
  useRealtime();
  usePageViews();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const user = useAppSelector((state) => state.auth.user);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const [langAnchor, setLangAnchor] = useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null);

  const isStaff = user && (user.role === 'INSTRUCTOR' || user.role === 'ADMIN');
  const isAdmin = user?.role === 'ADMIN';

  const openMenu = (setter: (el: HTMLElement | null) => void) => (event: MouseEvent<HTMLElement>) =>
    setter(event.currentTarget);

  const handleLogout = async () => {
    setUserAnchor(null);
    setDrawerOpen(false);
    await logoutUser();
    queryClient.clear();
    dispatch(loggedOut());
    navigate('/login');
  };

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  const activeThemeIcon =
    themeMode === 'light' ? (
      <LightModeIcon />
    ) : themeMode === 'dark' ? (
      <DarkModeIcon />
    ) : (
      <SettingsBrightnessIcon />
    );

  const renderDrawerItems = (items: NavItem[]) =>
    items.map((item) => (
      <ListItem key={item.to} disablePadding>
        <ListItemButton
          component={RouterLink}
          to={item.to}
          selected={isActive(item.to)}
          onClick={() => setDrawerOpen(false)}
        >
          <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
          <ListItemText>{t(item.labelKey)}</ListItemText>
        </ListItemButton>
      </ListItem>
    ));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="default"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 0.5, px: { xs: 1, sm: 2 } }}>
          <IconButton
            aria-label={t('nav.openMenu', { defaultValue: 'Open menu' })}
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            edge="start"
          >
            <MenuIcon />
          </IconButton>

          <SchoolIcon color="primary" aria-hidden />
          <Typography
            variant="h6"
            component="span"
            sx={{ fontWeight: 700, display: { xs: 'none', md: 'block' }, whiteSpace: 'nowrap' }}
          >
            {t('app.name')}
          </Typography>

          <Box
            component="nav"
            sx={{
              display: { xs: 'none', md: 'flex' },
              gap: 0.5,
              ml: 2,
              flexGrow: 1,
              '& .MuiButton-root': { whiteSpace: 'nowrap' },
            }}
          >
            {MAIN_NAV.map((item) => (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                color="inherit"
                size="small"
              >
                {t(item.labelKey)}
              </Button>
            ))}
            {isStaff
              ? [...INSTRUCTOR_NAV, ...(isAdmin ? ADMIN_NAV : [])].map((item) => (
                  <Button
                    key={item.to}
                    component={RouterLink}
                    to={item.to}
                    color="inherit"
                    size="small"
                  >
                    {t(item.labelKey)}
                  </Button>
                ))
              : null}
          </Box>

          <Box sx={{ flexGrow: { xs: 1, md: 0 } }} />

          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <StatsBadge />
          </Box>
          <NotificationBell />

          <Tooltip title={t('nav.theme')}>
            <IconButton
              aria-label={t('nav.theme')}
              onClick={openMenu(setThemeAnchor)}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
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
            <IconButton
              aria-label={t('nav.language')}
              onClick={openMenu(setLangAnchor)}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
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
            {ACCOUNT_NAV.map((item) => (
              <MenuItem
                key={item.to}
                component={RouterLink}
                to={item.to}
                onClick={() => setUserAnchor(null)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText>{t(item.labelKey)}</ListItemText>
              </MenuItem>
            ))}
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

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ display: { md: 'none' } }}
        slotProps={{ paper: { sx: { width: 280 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 2 }}>
          <SchoolIcon color="primary" aria-hidden />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t('app.name')}
          </Typography>
        </Box>
        <Divider />
        <List>{renderDrawerItems(MAIN_NAV)}</List>
        {isStaff ? (
          <>
            <Divider />
            <List subheader={<ListSubheader disableSticky>{t('nav.instructor')}</ListSubheader>}>
              {renderDrawerItems([...INSTRUCTOR_NAV, ...(isAdmin ? ADMIN_NAV : [])])}
            </List>
          </>
        ) : null}
        <Divider />
        <List>{renderDrawerItems(ACCOUNT_NAV)}</List>
        <Divider />
        <List
          subheader={<ListSubheader disableSticky>{t('nav.theme')}</ListSubheader>}
          sx={{ display: { sm: 'none' } }}
        >
          {THEME_OPTIONS.map((option) => (
            <ListItem key={option.mode} disablePadding>
              <ListItemButton
                selected={themeMode === option.mode}
                onClick={() => dispatch(themeModeChanged(option.mode))}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>{option.icon}</ListItemIcon>
                <ListItemText>{t(option.labelKey)}</ListItemText>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <List
          subheader={<ListSubheader disableSticky>{t('nav.language')}</ListSubheader>}
          sx={{ display: { sm: 'none' } }}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <ListItem key={locale.code} disablePadding>
              <ListItemButton
                selected={i18n.resolvedLanguage === locale.code}
                onClick={() => void i18n.changeLanguage(locale.code)}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>
                  {i18n.resolvedLanguage === locale.code ? <CheckIcon fontSize="small" /> : null}
                </ListItemIcon>
                <ListItemText>{locale.label}</ListItemText>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Container
        component="main"
        maxWidth="lg"
        sx={{ py: { xs: 2.5, md: 4 }, px: { xs: 2, sm: 3 }, flexGrow: 1 }}
      >
        <Outlet />
      </Container>
    </Box>
  );
}
