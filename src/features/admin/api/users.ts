import { useQuery } from '@tanstack/react-query';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, useApiMutation, usePagedList } from '@/lib/query';

import { roleKeys, userKeys } from './keys';
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

/** Replace the user's full set of roles (POST /users/{id}/roles with If-Match). */
export function useAssignRoles(user: User) {
  return useApiMutation({
    mutationFn: async (roles: readonly RoleGrant[]) =>
      (
        await api.post(
          `/users/${user.id}/roles`,
          { roles },
          { schema: UserSchema, versioned: true, ifMatch: user.version },
        )
      ).data,
    invalidates: () => [...userInvalidation(user.id), userKeys.sub(user.id, 'permissions')],
    conflictSubject: () => user.username,
  });
}
