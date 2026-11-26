import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A refused request (400–499) fails the same way the next time.
        retry: (failures, error) =>
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) && failures < 2,
        staleTime: 2_000,
      },
    },
  });
}
