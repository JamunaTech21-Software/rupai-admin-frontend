import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation } from '@/lib/query';

/**
 * System settings (P1.11, /settings): typed values by dotted key. key, value_type and is_encrypted are fixed at
 * creation. An encrypted setting is write-only: the API answers value null with has_value. Edits send If-Match.
 */

export const SETTING_TYPES = ['string', 'integer', 'decimal', 'boolean', 'json'] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

export const SettingSchema = z.looseObject({
  id: z.string(),
  key: z.string(),
  group: z.string(),
  value_type: z.enum(SETTING_TYPES),
  is_encrypted: z.boolean(),
  value: z.unknown(),
  has_value: z.boolean(),
  description: z.string().nullable(),
  version: z.number().int(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
});
export type Setting = z.infer<typeof SettingSchema>;

/** A value as the API takes it: a decimal is a string, an integer a number; null clears it. */
export type SettingValue = string | number | boolean | null | readonly unknown[] | Record<string, unknown>;

export const settingKeys = createQueryKeys('settings');

/** The API's page limit. Settings are few; the screen groups and searches them all at once. */
const ALL = 200;

export function useAllSettings() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: settingKeys.list('all'),
    queryFn: async ({ signal }) => {
      const response = await api.get('/settings', {
        query: { per_page: ALL, sort: 'group,key' },
        schema: z.array(SettingSchema),
        signal,
      });
      return { rows: response.data, total: response.meta?.pagination?.total ?? response.data.length };
    },
  });
}

export interface NewSetting {
  readonly key: string;
  readonly value_type: SettingType;
  readonly is_encrypted: boolean;
  readonly group?: string;
  readonly value: SettingValue;
  readonly description: string | null;
}

export function useCreateSetting() {
  return useApiMutation({
    mutationFn: async (input: NewSetting) =>
      (await api.post('/settings', input, { schema: SettingSchema })).data,
    invalidates: () => [settingKeys.all],
  });
}

/** Leave `value` out to keep the stored one (an encrypted value the user did not replace). */
export interface SettingChanges {
  readonly group?: string;
  readonly value?: SettingValue;
  readonly description?: string | null;
}

export function useUpdateSetting(setting: Pick<Setting, 'id' | 'version' | 'key'>) {
  return useApiMutation({
    mutationFn: async (changes: SettingChanges) =>
      (
        await api.patch(`/settings/${setting.id}`, changes, {
          schema: SettingSchema,
          ifMatch: setting.version,
        })
      ).data,
    invalidates: () => [settingKeys.all],
    conflictSubject: () => setting.key,
  });
}

export function useDeleteSetting(setting: Pick<Setting, 'id'>) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/settings/${setting.id}`);
    },
    invalidates: () => [settingKeys.all],
  });
}
