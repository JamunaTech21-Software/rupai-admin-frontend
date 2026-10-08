import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, isApiError } from '@/lib/api';
import { cachePolicy, useApiMutation } from '@/lib/query';

import { accessKeys, userKeys } from './keys';
import {
  AccessCheckSchema,
  type AuthorisationKind,
  AuthorisationSchema,
  ConcentrationReportSchema,
  SodRuleSchema,
  type User,
} from './schemas';
import { type RoleGrant } from './users';

/**
 * Separation of duties and sensitive permissions (P1.04). A conflicting combination or a sensitive permission
 * does not block a change: it needs a named authorisation with a written reason, which is recorded and shown on
 * the concentration report.
 */

/** Something that needs an authorisation, from either the preview or a 422 AUTHORISATION_REQUIRED. */
export interface NeededAuthorisation {
  readonly key: string;
  readonly kind: AuthorisationKind;
  readonly rule: string;
  /** The rule's title and why (preview), or the server's sentence (from a refusal). */
  readonly title: string;
  readonly why: string | null;
  readonly permissions: readonly string[];
  /** Set when the change affects several users (a role edit): whose authorisation this is. */
  readonly userId: string | null;
  readonly username: string | null;
}

/** What the user sends back: one reason per needed authorisation (user_id only for role changes). */
export interface GivenAuthorisation {
  readonly key: string;
  readonly reason: string;
  readonly user_id?: string;
}

/**
 * The requirements in a 422 AUTHORISATION_REQUIRED, or null for any other error. Each detail carries
 * `context {key, rule, kind, permissions, user_id, username}` and a sentence naming the user, rule and why.
 */
export function authorisationsRequired(error: unknown): NeededAuthorisation[] | null {
  if (!isApiError(error) || error.code !== 'AUTHORISATION_REQUIRED') return null;
  return error.details.flatMap((detail) => {
    const c = detail.context ?? {};
    if (typeof c.key !== 'string') return [];
    return [
      {
        key: c.key,
        kind: c.kind === 'sensitive_grant' ? 'sensitive_grant' : 'sod_override',
        rule: typeof c.rule === 'string' ? c.rule : '',
        title: detail.message,
        why: null,
        permissions: Array.isArray(c.permissions) ? c.permissions.filter((p) => typeof p === 'string') : [],
        userId: typeof c.user_id === 'string' ? c.user_id : null,
        username: typeof c.username === 'string' ? c.username : null,
      },
    ];
  });
}

/** Preview what a set of roles would require for a user (POST /users/{id}/roles/check). Changes nothing. */
export function useCheckRoles(user: User) {
  return useMutation({
    mutationFn: async (roles: readonly RoleGrant[]) =>
      (await api.post(`/users/${user.id}/roles/check`, { roles }, { schema: AccessCheckSchema })).data,
    retry: false,
  });
}

/** A user's authorisations, active and removed (GET /users/{id}/authorisations). */
export function useUserAuthorisations(userId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: userKeys.sub(userId, 'authorisations'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/users/${userId}/authorisations`, {
          query: { per_page: 100 },
          schema: z.array(AuthorisationSchema),
          signal,
        })
      ).data,
  });
}

/** Withdraw an authorisation. It stays on record as removed; the user keeps their roles. */
export function useRemoveAuthorisation(userId: string) {
  return useApiMutation({
    mutationFn: async (authorisationId: string) => {
      await api.delete(`/users/${userId}/authorisations/${authorisationId}`);
    },
    invalidates: () => [userKeys.sub(userId, 'authorisations'), accessKeys.all],
  });
}

export function useConcentrationReport() {
  return useQuery({
    ...cachePolicy('transactional'),
    queryKey: accessKeys.detail('concentration-report'),
    queryFn: async ({ signal }) =>
      (await api.get('/access/concentration-report', { schema: ConcentrationReportSchema, signal })).data,
  });
}

/** The separation-of-duties rules (reference; they ship with the system). */
export function useSodRules(enabled = true) {
  return useQuery({
    ...cachePolicy('reference'),
    queryKey: accessKeys.list('sod-rules'),
    queryFn: async ({ signal }) =>
      (
        await api.get('/access/sod-rules', {
          query: { per_page: 50 },
          schema: z.array(SodRuleSchema),
          signal,
        })
      ).data,
    enabled,
  });
}

/**
 * Reason or key errors the server found in the authorisations sent (422 VALIDATION_FAILED on
 * `authorisations.N.reason` / `.key`), by index N, or null when the error is something else.
 */
export function authorisationErrors(error: unknown): Record<number, string> | null {
  if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return null;
  const out: Record<number, string> = {};
  for (const detail of error.fieldErrors) {
    const match = /^authorisations\.(\d+)\.(?:reason|key)$/.exec(detail.field ?? '');
    if (match?.[1]) out[Number.parseInt(match[1], 10)] = detail.message;
  }
  return Object.keys(out).length > 0 ? out : null;
}
