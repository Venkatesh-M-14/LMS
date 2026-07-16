import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Brand: deep indigo primary with an amber accent — calm enough to read
 * lessons against, loud enough for progress moments.
 */
export function buildTheme(mode: 'light' | 'dark'): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#3f51b5' : '#7986cb' },
      secondary: { main: '#ffb300' },
      background:
        mode === 'light'
          ? { default: '#f7f8fc', paper: '#ffffff' }
          : { default: '#10121a', paper: '#181b26' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
      h1: { fontSize: '2.25rem', fontWeight: 700 },
      h2: { fontSize: '1.75rem', fontWeight: 700 },
      h3: { fontSize: '1.375rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
    },
  });
}
