import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cachePolicy, useApiMutation } from '@/lib/query';

import { userKeys } from './keys';
import { type GrantableScopeType, type ScopeGrant, ScopeGrantSchema, type User } from './schemas';

/**
 * A user's data-scope grants (P1.03, /users/{id}/scopes). A user holds a handful, so the tab reads them all in
 * one page (the API clamps per_page to 200).
 */
export function useUserScopes(userId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: userKeys.sub(userId, 'scopes'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/users/${userId}/scopes`, {
          query: { per_page: 200 },
          schema: z.array(ScopeGrantSchema),
          signal,
        })
      ).data,
  });
}

/**
 * Scope is resolved per request, so a change applies at the user's next call. When admins change their own
 * scope, /auth/me is read again so the estate selector follows at once.
 */
function useReloadIfSelf(user: User) {
  const auth = useAuth();
  return () => {
    if (auth.state.status === 'signed-in' && auth.state.me.user.id === user.id) void auth.reload();
  };
}

export interface GrantScopeInput {
  readonly scope_type: GrantableScopeType;
  /** Omitted for all_estates. */
  readonly scope_id?: string;
  readonly expires_at: string | null;
}

export function useGrantScope(user: User) {
  const idempotency = useIdempotencyKey();
  const reloadIfSelf = useReloadIfSelf(user);
  return useApiMutation({
    mutationFn: async (input: GrantScopeInput) =>
      (
        await api.post(`/users/${user.id}/scopes`, input, {
          schema: ScopeGrantSchema,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [userKeys.sub(user.id, 'scopes')],
    onSuccess: () => {
      idempotency.reset();
      reloadIfSelf();
    },
  });
}

/** Change or remove (null) a grant's expiry. Its target never changes: revoke and grant again instead. */
export function useSetScopeExpiry(user: User, grant: ScopeGrant) {
  const reloadIfSelf = useReloadIfSelf(user);
  return useApiMutation({
    mutationFn: async (expiresAt: string | null) =>
      (
        await api.patch(
          `/users/${user.id}/scopes/${grant.id}`,
          { expires_at: expiresAt },
          { schema: ScopeGrantSchema, ifMatch: grant.version },
        )
      ).data,
    invalidates: () => [userKeys.sub(user.id, 'scopes')],
    conflictSubject: () => user.username,
    onSuccess: reloadIfSelf,
  });
}

export function useRevokeScope(user: User) {
  const reloadIfSelf = useReloadIfSelf(user);
  return useApiMutation({
    mutationFn: async (grant: ScopeGrant) => {
      await api.delete(`/users/${user.id}/scopes/${grant.id}`);
    },
    invalidates: () => [userKeys.sub(user.id, 'scopes')],
    onSuccess: reloadIfSelf,
  });
}
