import { createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';

/**
 * Brand: midnight navy with champagne-gold accents over warm porcelain
 * (light) or rich near-black (dark) — quiet luxury that stays readable
 * through long lessons, with gold reserved for moments of progress.
 */
const serif = ['Fraunces', 'Georgia', 'Times New Roman', 'serif'].join(',');
const sans = ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(',');

const navy = { main: '#1f2a44', light: '#3d4c74', dark: '#141d33' };
const gold = { main: '#b3903f', light: '#d3b678', dark: '#8a6d2a' };

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const light = mode === 'light';

  const theme = createTheme({
    palette: {
      mode,
      primary: light
        ? { ...navy, contrastText: '#f5f1e8' }
        : { main: gold.light, light: '#e6d4a8', dark: gold.main, contrastText: '#171408' },
      secondary: light
        ? { ...gold, contrastText: '#241b07' }
        : { main: '#8fa3c8', light: '#b4c3de', dark: '#66799c', contrastText: '#0d1017' },
      background: light
        ? { default: '#f8f6f1', paper: '#fffdf9' }
        : { default: '#0d0f14', paper: '#151821' },
      text: light
        ? { primary: '#201d18', secondary: '#5d574b' }
        : { primary: '#ece7dc', secondary: '#a49d8d' },
      divider: light ? 'rgba(31, 42, 68, 0.14)' : 'rgba(211, 182, 120, 0.16)',
      success: { main: light ? '#2e6b4f' : '#7fb89a' },
      error: { main: light ? '#963b3b' : '#d98b8b' },
      warning: { main: light ? '#a5701d' : '#d9ad66' },
      info: { main: light ? '#31567d' : '#8fb3d9' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: sans,
      h1: { fontFamily: serif, fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-0.01em' },
      h2: { fontFamily: serif, fontSize: '1.9rem', fontWeight: 600, letterSpacing: '-0.005em' },
      h3: { fontFamily: serif, fontSize: '1.45rem', fontWeight: 600 },
      h4: { fontFamily: serif, fontSize: '1.2rem', fontWeight: 600 },
      h5: { fontSize: '1.05rem', fontWeight: 600 },
      h6: { fontSize: '1rem', fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      overline: { letterSpacing: '0.14em', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 10 },
          containedPrimary: light
            ? {
                backgroundImage: 'linear-gradient(180deg, #26335200, #141d3326)',
                '&:hover': { backgroundColor: navy.dark },
              }
            : {
                backgroundImage: 'linear-gradient(180deg, #e6d4a800, #8a6d2a26)',
                '&:hover': { backgroundColor: gold.main },
              },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: light ? 'rgba(31, 42, 68, 0.14)' : 'rgba(211, 182, 120, 0.16)',
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: '1px solid',
            borderColor: light ? 'rgba(31, 42, 68, 0.12)' : 'rgba(211, 182, 120, 0.14)',
            boxShadow: light
              ? '0 1px 2px rgba(31, 42, 68, 0.05), 0 8px 24px -12px rgba(31, 42, 68, 0.12)'
              : '0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px -12px rgba(0, 0, 0, 0.5)',
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99, height: 6 },
          bar: { borderRadius: 99 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: light ? { backgroundColor: navy.main } : undefined,
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundImage: 'none' },
        },
      },
    },
  });

  return responsiveFontSizes(theme);
}
