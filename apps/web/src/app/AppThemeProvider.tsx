import { useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAppSelector } from './hooks';
import { buildTheme } from './theme';

export function AppThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const mode = useAppSelector((state) => state.ui.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  const theme = useMemo(() => buildTheme(resolved), [resolved]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
