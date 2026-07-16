import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from './store';
import { queryClient } from './queryClient';
import { router } from './router';
import { AppThemeProvider } from './AppThemeProvider';
import { RootErrorBoundary } from '../shared/components/RootErrorBoundary';
import { PwaPrompts } from '../shared/pwa/PwaPrompts';

export function App() {
  return (
    <RootErrorBoundary>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <CssBaseline enableColorScheme />
            <RouterProvider router={router} />
            <PwaPrompts />
          </AppThemeProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </RootErrorBoundary>
  );
}
