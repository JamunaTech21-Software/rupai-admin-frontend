import { type QueryKey, useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';

import { ApiError, isApiError } from '../api';

import { reportConflict } from './conflicts';

export interface ApiMutationOptions<TData, TVariables> {
  readonly mutationFn: (variables: TVariables) => Promise<TData>;
  /**
   * The invalidation set, declared with the mutation (Spec P5 §4.3): the queries this change makes stale.
   * Usually the record's detail and every list of its resource: `[userKeys.detail(id), userKeys.lists()]`.
   */
  readonly invalidates: (data: TData | undefined, variables: TVariables) => readonly QueryKey[];
  /**
   * On 409 VERSION_CONFLICT the conflict dialog opens with this subject ("Worker Rahim Uddin"). Reload
   * refetches the invalidation set, so the form shows the current version for the user to reapply.
   */
  readonly conflictSubject?: (variables: TVariables) => string;
  readonly onSuccess?: (data: TData, variables: TVariables) => void;
}

/**
 * A mutation that follows the house rules: no automatic retry, its invalidation set refreshed after success,
 * and a stale version turned into the conflict dialog instead of a generic error.
 */
export function useApiMutation<TData, TVariables>(
  options: ApiMutationOptions<TData, TVariables>,
): UseMutationResult<TData, Error, TVariables> {
  const queryClient = useQueryClient();
  const refresh = (keys: readonly QueryKey[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))).then(() => undefined);

  return useMutation<TData, Error, TVariables>({
    mutationFn: options.mutationFn,
    retry: false,
    onSuccess: async (data, variables) => {
      await refresh(options.invalidates(data, variables));
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (isApiError(error, 'VERSION_CONFLICT')) {
        reportConflict({
          subject: options.conflictSubject?.(variables) ?? 'This record',
          requestId: error instanceof ApiError ? error.requestId : null,
          reload: () => refresh(options.invalidates(undefined, variables)),
        });
      }
    },
  });
}
