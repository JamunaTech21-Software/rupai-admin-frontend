import { QueryClient } from '@tanstack/react-query';

import { ApiError, ClientContractError, NetworkError } from '../api';

import { CACHE_POLICIES } from './cachePolicy';

/**
 * Whether a failed READ is worth trying again: a dropped connection or a 5xx/503 may pass; a 4xx will not
 * (wrong input, no permission, not found). Two attempts at most, after 1 s and 2 s.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 429;
  return !(error instanceof ClientContractError);
}

/**
 * The app's query client (Spec P5 §4). Queries default to the `master` policy unless they name another.
 * Mutations NEVER retry by themselves: a retried approval could approve twice. Retrying a mutation is the
 * user's decision, with the same Idempotency-Key.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...CACHE_POLICIES.master,
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}
