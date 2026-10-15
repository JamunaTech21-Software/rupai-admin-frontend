import { type QueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, type ApiClient } from './api';
import { cachePolicy, createQueryKeys } from './query';

/**
 * The reference masters (P1.10) as every screen reads them: the ACTIVE rows of each type, fetched once after
 * sign-in (GET /lookups) and kept for the session under the `reference` cache policy. Countries are the bulk of
 * the rows and few screens need them, so they load on first use.
 *
 *   const departments = useActiveLookups('department');
 *   <Select options={(departments.data ?? []).map(lookupOption)} />
 *
 * Maintaining the masters (lists with inactive rows, add, edit, deactivate) is the reference feature's job.
 */

export const LOOKUP_TYPES = [
  'department',
  'designation',
  'worker_category',
  'employee_category',
  'employment_type',
  'leave_type',
  'buyer_type',
  'trading_type',
  'packaging_type',
  'charge_type',
  'document_type',
  'payment_method',
  'land_type',
  'adjustment_reason',
  'quality_grade',
  'collection_point_type',
  'amenity',
  'tea_type',
  'tea_grade',
  'activity_type',
  'shift',
  'uom_category',
  'tea_variety',
  'uom',
  'currency',
  'country',
] as const;
export type LookupType = (typeof LOOKUP_TYPES)[number];

/** Any reference row: every type has these, plus its own fields (code, name, iso2, …). */
export const LookupRowSchema = z.looseObject({
  id: z.string(),
  status: z.enum(['active', 'inactive']),
  version: z.number(),
});
export type LookupRow = z.infer<typeof LookupRowSchema>;

const ActiveLookupsSchema = z.record(z.string(), z.array(LookupRowSchema));

export const lookupKeys = createQueryKeys('lookups');
const BOOTSTRAP_TYPES = LOOKUP_TYPES.filter((type) => type !== 'country');
const bootstrapKey = lookupKeys.list('active');
const countryKey = lookupKeys.list('active:country');

async function fetchActive(client: ApiClient, types: readonly LookupType[], signal?: AbortSignal) {
  const response = await client.get('/lookups', {
    query: { types: types.join(',') },
    schema: ActiveLookupsSchema,
    ...(signal ? { signal } : {}),
  });
  return response.data;
}

/**
 * Loads the selection lists before the app renders (Spec P5 §3.5). A failure is not fatal: the lists load again
 * when a screen first asks for them.
 */
export async function primeLookups(queryClient: QueryClient, client: ApiClient = api): Promise<void> {
  await queryClient
    .query({
      ...cachePolicy('reference'),
      queryKey: bootstrapKey,
      queryFn: () => fetchActive(client, BOOTSTRAP_TYPES),
      retry: false,
    })
    .catch(() => undefined);
}

/** The active rows of one type, in display order. Needs lookup.view; pass `enabled: false` to skip the request. */
export function useActiveLookups(type: LookupType, enabled = true) {
  const isCountry = type === 'country';
  return useQuery({
    ...cachePolicy('reference'),
    queryKey: isCountry ? countryKey : bootstrapKey,
    enabled,
    queryFn: ({ signal }) => fetchActive(api, isCountry ? ['country'] : BOOTSTRAP_TYPES, signal),
    select: (data) => data[type] ?? [],
  });
}

/** A text field of a reference row ('' when it has none). */
export function lookupText(row: LookupRow | undefined, field: string): string {
  const value = row?.[field];
  return typeof value === 'string' ? value : '';
}

/** "KG · Kilogram": how a reference row reads in a picker or a cell. Countries have no code: their name. */
export function lookupLabel(row: LookupRow): string {
  const code = lookupText(row, 'code');
  const name = lookupText(row, 'name');
  return code && name ? `${code} · ${name}` : name || code || `#${row.id}`;
}

/** A reference row as a Select option. */
export function lookupOption(row: LookupRow): { id: string; label: string } {
  return { id: row.id, label: lookupLabel(row) };
}
