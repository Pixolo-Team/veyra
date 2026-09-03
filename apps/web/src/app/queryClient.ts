import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api/client';

/**
 * A 401 means the session is gone — retrying it just burns requests, and the
 * router's auth guard is what should react. Same for 403/404: the answer will
 * not change on a second try.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(error.status)) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
