import { QueryClient } from "@tanstack/react-query";

/**
 * Create a new QueryClient instance.
 * Returns a new instance each time for SSR safety (avoid sharing state between requests).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30 seconds
        staleTime: 30 * 1000,
        // Garbage collect after 5 minutes of no observers
        gcTime: 5 * 60 * 1000,
        // Retry 3 times with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex) => {
          // Exponential backoff: 1s, 2s, 4s, capped at 30s
          return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
        },
        // Refetch when window regains focus
        refetchOnWindowFocus: true,
        // Refetch when component mounts
        refetchOnMount: true,
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}
