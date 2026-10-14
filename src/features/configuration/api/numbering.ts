import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Document numbering (P1.11, /number-formats). One format per document type, seeded by the server: the set
 * cannot grow or shrink, only how each number looks. Edits send If-Match with the version read.
 */

export const NUMBER_COMPONENTS = ['estate', 'fiscal_year', 'season'] as const;
export type NumberComponent = (typeof NUMBER_COMPONENTS)[number];
export const SEPARATORS = ['-', '/', '.', ''] as const;
export type Separator = (typeof SEPARATORS)[number];
export const RESET_FREQUENCIES = ['never', 'yearly', 'monthly'] as const;
export type ResetFrequency = (typeof RESET_FREQUENCIES)[number];

export const NumberFormatSchema = z.looseObject({
  id: z.string(),
  document_type: z.string(),
  label: z.string(),
  lifecycle: z.enum(['financial', 'operational']),
  available_components: z.array(z.enum(NUMBER_COMPONENTS)),
  prefix: z.string(),
  include_fiscal_year: z.boolean(),
  include_season: z.boolean(),
  include_estate_code: z.boolean(),
  separator: z.string(),
  sequence_width: z.number().int(),
  reset_frequency: z.enum(RESET_FREQUENCIES),
  is_gapless: z.boolean(),
  example: z.string(),
  version: z.number().int(),
  updated_at: z.string().nullable(),
});
export type NumberFormat = z.infer<typeof NumberFormatSchema>;

export const NumberSequenceSchema = z.object({
  scope_key: z.string(),
  last_number: z.string(),
  updated_at: z.string(),
});
export type NumberSequence = z.infer<typeof NumberSequenceSchema>;

const NumberPreviewSchema = z.object({
  next_number: z.string(),
  scope_key: z.string(),
  last_number: z.string(),
});

export const numberFormatKeys = createQueryKeys('number-formats');

/** The flag that switches a component on. */
export const COMPONENT_FIELD = {
  estate: 'include_estate_code',
  fiscal_year: 'include_fiscal_year',
  season: 'include_season',
} as const satisfies Record<NumberComponent, keyof NumberFormat>;

/** All 20 formats fit on one page; the URL keeps the filter. */
export function useNumberFormatList() {
  return usePagedList({
    keys: numberFormatKeys,
    path: '/number-formats',
    row: NumberFormatSchema,
    defaultSort: 'document_type',
    pageSize: 50,
  });
}

export interface NumberFormatInput {
  readonly prefix: string;
  readonly separator: Separator;
  readonly sequence_width: number;
  readonly reset_frequency: ResetFrequency;
  readonly include_estate_code: boolean;
  readonly include_fiscal_year: boolean;
  readonly include_season: boolean;
}

export function useUpdateNumberFormat(format: NumberFormat) {
  return useApiMutation({
    mutationFn: async (input: Partial<NumberFormatInput>) =>
      (
        await api.patch(`/number-formats/${format.id}`, input, {
          schema: NumberFormatSchema,
          ifMatch: format.version,
        })
      ).data,
    invalidates: () => [numberFormatKeys.all],
    conflictSubject: () => format.label,
  });
}

/** The counters of one format, one per scope (estate, year, …), read-only. */
export function useNumberSequences(id: string) {
  return useQuery({
    ...cachePolicy('transactional'),
    queryKey: numberFormatKeys.sub(id, 'sequences'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/number-formats/${id}/sequences`, {
          schema: z.array(NumberSequenceSchema),
          signal,
        })
      ).data,
  });
}

/** The number the next document would get in the sample scope. Asking allocates nothing. */
export function useNextNumber(format: Pick<NumberFormat, 'id' | 'version'>) {
  return useQuery({
    ...cachePolicy('transactional'),
    queryKey: numberFormatKeys.sub(format.id, 'preview', String(format.version)),
    queryFn: async ({ signal }) =>
      (await api.get(`/number-formats/${format.id}/preview`, { schema: NumberPreviewSchema, signal })).data,
  });
}
