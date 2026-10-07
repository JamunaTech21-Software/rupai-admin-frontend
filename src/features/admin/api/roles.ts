import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, useApiMutation, usePagedList } from '@/lib/query';

import { permissionKeys, roleKeys, userKeys } from './keys';
import { type Permission, PermissionSchema, type Role, RoleSchema } from './schemas';

export function useRolesList() {
  return usePagedList({
    keys: roleKeys,
    path: '/roles',
    row: RoleSchema,
    defaultSort: 'sort_order',
    pageSize: 25,
  });
}

/** Every role, for pickers (the role list is small: one page of 200). */
export function useAllRoles() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: roleKeys.list('all'),
    queryFn: async ({ signal }) =>
      (
        await api.get('/roles', {
          query: { sort: 'sort_order', per_page: 200 },
          schema: z.array(RoleSchema),
          signal,
        })
      ).data,
  });
}

export function useRole(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: roleKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/roles/${id}`, { schema: RoleSchema, signal })).data,
  });
}

/**
 * The whole permission catalogue (about 630 entries) for the matrix: reference data, fetched in pages of 200
 * and cached for an hour.
 */
export function usePermissionCatalogue() {
  return useQuery({
    ...cachePolicy('reference'),
    queryKey: permissionKeys.list('all'),
    queryFn: async ({ signal }) => {
      const all: Permission[] = [];
      for (let page = 1; ; page += 1) {
        const response = await api.get('/permissions', {
          query: { sort: 'module', per_page: 200, page },
          schema: z.array(PermissionSchema),
          signal,
        });
        all.push(...response.data);
        const lastPage = response.meta?.pagination?.last_page ?? page;
        if (page >= lastPage) break;
      }
      return all;
    },
  });
}

export interface RoleInput {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly sort_order: number;
  readonly permissions: readonly string[];
}

const roleInvalidation = (id: string) => [roleKeys.detail(id), roleKeys.lists(), userKeys.all];

export function useCreateRole() {
  return useApiMutation({
    mutationFn: async (input: RoleInput) => (await api.post('/roles', input, { schema: RoleSchema })).data,
    invalidates: () => [roleKeys.lists()],
  });
}

/**
 * Save a role. A system role only accepts name, description and sort order (the rest answers SYSTEM_RECORD), so
 * for it only those are sent, with PATCH.
 */
export function useUpdateRole(role: Role) {
  return useApiMutation({
    mutationFn: async (input: RoleInput) => {
      const response = role.is_system
        ? await api.patch(
            `/roles/${role.id}`,
            { name: input.name, description: input.description, sort_order: input.sort_order },
            { schema: RoleSchema, ifMatch: role.version },
          )
        : await api.put(`/roles/${role.id}`, input, { schema: RoleSchema, ifMatch: role.version });
      return response.data;
    },
    invalidates: () => roleInvalidation(role.id),
    conflictSubject: () => role.name,
  });
}

export function useSetRoleStatus(role: Role) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'deactivate' | 'reactivate') =>
      (
        await api.post(`/roles/${role.id}/${action}`, undefined, {
          schema: RoleSchema,
          versioned: true,
          ifMatch: role.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => roleInvalidation(role.id),
    conflictSubject: () => role.name,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteRole(role: Role) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/roles/${role.id}`);
    },
    invalidates: () => [roleKeys.lists(), userKeys.all],
  });
}
