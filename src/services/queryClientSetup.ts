import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on every window focus (avoid bandwidth waste)
      refetchOnWindowFocus: false,
      // Cache for 30 seconds
      staleTime: 30 * 1000,
      // Retry once on failure
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});
