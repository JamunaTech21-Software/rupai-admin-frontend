import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { lookupKeys, type LookupRow, LookupRowSchema, lookupText } from '@/lib/lookups';
import { cachePolicy, createQueryKeys, type QueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import { type MasterType } from '../masters';

/**
 * Hooks for maintaining the reference masters (P1.10). Every type has the same API at its own path, so one set
 * of hooks serves them all from a descriptor. Edits and status changes send If-Match with the version read;
 * status changes also send an Idempotency-Key. Any change also refreshes the selection lists (lib/lookups).
 */

export type MasterRow = LookupRow;

const masterKeys = createQueryKeys('masters');

/** One type's lists, under the shared `masters` key so a change to one master refreshes those that show it. */
function keysOf(type: MasterType): QueryKeys {
  return { ...masterKeys, list: (query: string) => masterKeys.list(`${type.key}?${query}`) };
}

const changed = () => [masterKeys.all, lookupKeys.all];

/** What a row is called in messages: its name. */
export const rowName = (row: MasterRow) => lookupText(row, 'name') || `#${row.id}`;

/** A system record, or the base unit or currency: the application depends on it, so it is never retired. */
export function isProtected(type: MasterType, row: MasterRow): boolean {
  return (type.hasSystem && row.is_system === true) || (type.hasBase === true && row.is_base === true);
}

/** The list of one master, active and inactive rows, driven by the URL. */
export function useMasterList(type: MasterType) {
  return usePagedList({
    keys: keysOf(type),
    path: type.path,
    row: LookupRowSchema,
    defaultSort: type.defaultSort,
    pageSize: 25,
  });
}

/** Every row of a small master (unit categories, units): one page of 500, the API's maximum. */
export function useAllMasterRows(type: MasterType, enabled = true) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: keysOf(type).list('all'),
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get(type.path, {
          query: { per_page: 500, sort: type.defaultSort },
          schema: z.array(LookupRowSchema),
          signal,
        })
      ).data,
  });
}

export type MasterInput = Readonly<Record<string, string | number | boolean | null>>;

export function useCreateMaster(type: MasterType) {
  return useApiMutation({
    mutationFn: async (input: MasterInput) =>
      (await api.post(type.path, input, { schema: LookupRowSchema })).data,
    invalidates: changed,
  });
}

/** PATCH: only what the form edits is sent, so fields the server maintains are never touched. */
export function useUpdateMaster(type: MasterType, row: Pick<MasterRow, 'id' | 'version'>, subject: string) {
  return useApiMutation({
    mutationFn: async (input: MasterInput) =>
      (await api.patch(`${type.path}/${row.id}`, input, { schema: LookupRowSchema, ifMatch: row.version }))
        .data,
    invalidates: changed,
    conflictSubject: () => subject,
  });
}

/** Deactivate or reactivate (POST {path}/{id}/deactivate|reactivate). A system record answers 422 SYSTEM_RECORD. */
export function useSetMasterStatus(type: MasterType, row: MasterRow) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'deactivate' | 'reactivate') => {
      await api.post(`${type.path}/${row.id}/${action}`, undefined, {
        versioned: true,
        ifMatch: row.version,
        idempotencyKey: idempotency.key(),
      });
    },
    invalidates: changed,
    conflictSubject: () => rowName(row),
    onSuccess: idempotency.reset,
  });
}

/** Delete a row nothing refers to; 422 REFERENCED_RECORD otherwise (deactivate instead). */
export function useDeleteMaster(type: MasterType, row: MasterRow) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`${type.path}/${row.id}`);
    },
    invalidates: changed,
  });
}

// ---- Estates, for shifts ------------------------------------------------------------------------------------

const EstateOptionSchema = z.object({ id: z.string(), code: z.string(), name: z.string() });
const estateOptionKeys = createQueryKeys('reference-estates');

/** The estates the user may see, as options (a shift belongs to one estate or to all). Needs estate.view. */
export function useEstateOptions(enabled: boolean) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateOptionKeys.list('all'),
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get('/estates', {
          query: { per_page: 200, sort: 'code' },
          schema: z.array(EstateOptionSchema),
          signal,
        })
      ).data,
  });
}
