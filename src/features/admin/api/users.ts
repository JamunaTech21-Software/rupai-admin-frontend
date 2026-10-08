import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, useApiMutation, usePagedList } from '@/lib/query';

import { accessKeys, roleKeys, userKeys } from './keys';
import { type User, UserPermissionsSchema, UserSchema } from './schemas';

/** The users list, driven by the URL (filters, sort, page). */
export function useUsersList() {
  return usePagedList({
    keys: userKeys,
    path: '/users',
    row: UserSchema,
    defaultSort: 'username',
    pageSize: 25,
  });
}

export function useUser(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: userKeys.detail(id),
    queryFn: async ({ signal }) => {
      const response = await api.get(`/users/${id}`, { schema: UserSchema, signal });
      return response.data;
    },
  });
}

/** What the user can actually do: the union of their active roles' permissions. */
export function useUserPermissions(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: userKeys.sub(id, 'permissions'),
    queryFn: async ({ signal }) =>
      (await api.get(`/users/${id}/permissions`, { schema: UserPermissionsSchema, signal })).data,
  });
}

/** Every change to a user can change their effective permissions and the role counts. */
const userInvalidation = (id: string) => [userKeys.detail(id), userKeys.lists(), roleKeys.lists()];

export interface CreateUserInput {
  readonly username: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly initial_password: string;
}

export function useCreateUser() {
  return useApiMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await api.post('/users', input, { schema: UserSchema })).data,
    invalidates: () => [userKeys.lists()],
  });
}

export interface UpdateUserInput {
  readonly username: string;
  readonly email: string | null;
  readonly phone: string | null;
}

export function useUpdateUser(user: User) {
  return useApiMutation({
    mutationFn: async (input: UpdateUserInput) =>
      (await api.put(`/users/${user.id}`, input, { schema: UserSchema, ifMatch: user.version })).data,
    invalidates: () => userInvalidation(user.id),
    conflictSubject: () => user.username,
  });
}

/**
 * Deactivate or reactivate: a versioned transition, so it carries If-Match and an Idempotency-Key that is kept
 * across retries of the same press.
 */
export function useSetUserStatus(user: User) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'deactivate' | 'reactivate') =>
      (
        await api.post(`/users/${user.id}/${action}`, undefined, {
          schema: UserSchema,
          versioned: true,
          ifMatch: user.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => userInvalidation(user.id),
    conflictSubject: () => user.username,
    onSuccess: idempotency.reset,
  });
}

/** Delete: only for accounts never used (the backend answers REFERENCED_RECORD otherwise). */
export function useDeleteUser(user: User) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/users/${user.id}`);
    },
    invalidates: () => [userKeys.lists(), roleKeys.lists()],
  });
}

export interface RoleGrant {
  readonly role_id: string;
  readonly expires_at: string | null;
}

export interface AssignRolesInput {
  readonly roles: readonly RoleGrant[];
  /** One per conflict or sensitive permission the roles bring (P1.04); reason at least 10 characters. */
  readonly authorisations?: readonly { readonly key: string; readonly reason: string }[];
}

/**
 * Replace the user's full set of roles (POST /users/{id}/roles with If-Match). Without the authorisations it
 * needs, the server answers 422 AUTHORISATION_REQUIRED (see api/access.ts).
 */
export function useAssignRoles(user: User) {
  return useApiMutation({
    mutationFn: async ({ roles, authorisations }: AssignRolesInput) =>
      (
        await api.post(
          `/users/${user.id}/roles`,
          { roles, ...(authorisations && authorisations.length > 0 ? { authorisations } : {}) },
          { schema: UserSchema, versioned: true, ifMatch: user.version },
        )
      ).data,
    invalidates: () => [
      ...userInvalidation(user.id),
      userKeys.sub(user.id, 'permissions'),
      userKeys.sub(user.id, 'authorisations'),
      accessKeys.all,
    ],
    conflictSubject: () => user.username,
  });
}

/**
 * Usernames by id, for showing who authorised something (the API returns only ids there). One page of 200
 * covers every account an estate has; an unknown id falls back to "#id" on screen.
 */
export function useUserDirectory() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: userKeys.list('directory'),
    queryFn: async ({ signal }) => {
      const response = await api.get('/users', {
        query: { per_page: 200, sort: 'username' },
        schema: z.array(UserSchema),
        signal,
      });
      return new Map(response.data.map((user) => [user.id, user.username]));
    },
  });
}
