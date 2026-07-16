import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../shared/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Client errors are deterministic — retrying only hides bugs.
        if (error instanceof ApiClientError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
