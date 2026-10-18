import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys } from '@/lib/query';

/**
 * System health (P1.18, system.view): the operational view somebody reads every morning: one check per signal
 * (database, connections, the job queue, failed jobs, workers, scheduler, disk, backup, failed logins), the worst of
 * them as the overall status, and the version. A check that cannot be read is "unknown"; the endpoint always answers.
 * Signals whose source comes in a later phase are "not_applicable".
 */

export const healthKeys = createQueryKeys('system-health');

export const CHECK_STATUSES = ['ok', 'warning', 'critical', 'unknown', 'not_applicable'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export type OverallStatus = Exclude<CheckStatus, 'not_applicable'>;

const CheckSchema = z.looseObject({
  key: z.string(),
  label: z.string(),
  status: z.enum(CHECK_STATUSES),
  value: z.string().nullable(),
  detail: z.string(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type Check = z.infer<typeof CheckSchema>;

const HealthSchema = z.looseObject({
  status: z.enum(['ok', 'warning', 'critical', 'unknown']),
  as_of: z.string(),
  took_ms: z.number().int(),
  version: z.object({
    app: z.string(),
    commit: z.string(),
    environment: z.string(),
    node: z.string(),
    uptime_seconds: z.number().int(),
  }),
  checks: z.array(CheckSchema),
});
export type Health = z.infer<typeof HealthSchema>;

/** The report, fetched again every minute while the page is open (and on demand). */
export function useHealth() {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: healthKeys.list('report'),
    queryFn: async ({ signal }) => (await api.get('/system/health', { schema: HealthSchema, signal })).data,
  });
}
