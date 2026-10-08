import { useInfiniteQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys, type QueryKeys, useCursorList } from '@/lib/query';
import { filterKey } from '@/lib/urlState';

import { dhakaToday, endOfDhakaDay, startOfDhakaDay } from '../labels';

/**
 * The audit trail (P1.05, backend audit.routes.ts): field-level changes, status transitions and the access log.
 * Read-only and append-only. Every list is cursor-paged, newest first, and needs a time range (at most 366 days)
 * unless it names one record.
 */

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'post',
  'reverse',
  'cancel',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ACCESS_EVENTS = [
  'login',
  'logout',
  'failed_login',
  'lockout',
  'token_refresh',
  'refresh_reuse',
  'session_revoked',
  'password_changed',
  'password_change_failed',
  'password_reset',
  'password_reset_requested',
  'permission_denied',
  'scope_denied',
  'export',
  'print',
] as const;
export type AccessEvent = (typeof ACCESS_EVENTS)[number];

/** Events that are security information (P6 §11.4): shown highlighted, and the "security events" filter. */
export const SECURITY_EVENTS: readonly AccessEvent[] = [
  'refresh_reuse',
  'lockout',
  'permission_denied',
  'scope_denied',
];

/** The record types the backend audits so far; anything else is shown as written. */
export const RECORD_TYPES = [
  'user',
  'role',
  'user_scope',
  'access_authorisation',
  'organisation',
  'estate',
  'division',
  'section',
  'field',
] as const;

const UserRefSchema = z.object({ id: z.string(), username: z.string() }).nullable();

export const AuditChangeSchema = z.object({
  id: z.string(),
  record_type: z.string(),
  record_id: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  field: z.string().nullable(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  changed_by: UserRefSchema,
  acting_for_user_id: z.string().nullable(),
  changed_at: z.string(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  reason: z.string().nullable(),
});
export type AuditChange = z.infer<typeof AuditChangeSchema>;

export const StatusHistorySchema = z.object({
  id: z.string(),
  record_type: z.string(),
  record_id: z.string(),
  from_state: z.string().nullable(),
  to_state: z.string(),
  changed_by: UserRefSchema,
  changed_at: z.string(),
  workflow_step_id: z.string().nullable(),
  comment: z.string().nullable(),
});
export type StatusChange = z.infer<typeof StatusHistorySchema>;

export const AccessLogSchema = z.object({
  id: z.string(),
  user: UserRefSchema,
  event_type: z.enum(ACCESS_EVENTS),
  module: z.string().nullable(),
  record_reference: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  occurred_at: z.string(),
  detail: z.record(z.string(), z.unknown()).nullable(),
});
export type AccessLogEntry = z.infer<typeof AccessLogSchema>;

export const auditChangeKeys = createQueryKeys('audit-changes');
export const statusHistoryKeys = createQueryKeys('audit-status');
export const accessLogKeys = createQueryKeys('audit-access');

/** The default window: the last 7 days in Dhaka, as the URL filters for `field`. */
export function lastWeek(field: 'changed_at' | 'occurred_at'): Record<string, string> {
  return {
    [filterKey(field, 'from')]: startOfDhakaDay(dhakaToday(-6)),
    [filterKey(field, 'to')]: endOfDhakaDay(dhakaToday()),
  };
}

/** Admin → Audit → Changes: filters and range from the URL, "Load more" paging. */
export function useAuditChanges() {
  return useCursorList({
    keys: auditChangeKeys,
    path: '/audit/changes',
    row: AuditChangeSchema,
    defaultFilters: lastWeek('changed_at'),
  });
}

/** Admin → Audit → Access log. */
export function useAccessLog() {
  return useCursorList({
    keys: accessLogKeys,
    path: '/audit/access-log',
    row: AccessLogSchema,
    defaultFilters: lastWeek('occurred_at'),
  });
}

/** Any range is fine when one record is named; this one covers everything. */
const ALL_TIME = {
  'filter[changed_at][from]': '2000-01-01T00:00:00Z',
  'filter[changed_at][to]': '2100-01-01T00:00:00Z',
};

function useRecordList<T>(path: string, schema: z.ZodType<T>, keys: QueryKeys, type: string, id: string) {
  return useInfiniteQuery({
    ...cachePolicy('transactional'),
    queryKey: keys.list(`${type}:${id}`),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const query: Record<string, string> = {
        'filter[record_type]': type,
        'filter[record_id]': id,
        ...ALL_TIME,
        limit: '25',
      };
      if (pageParam) query.cursor = pageParam;
      return api.get(path, { query, schema: z.array(schema), signal });
    },
    getNextPageParam: (last) => last.meta?.cursor?.next_cursor ?? null,
  });
}

/** One record's field changes (the History panel on a user or role page). */
export function useRecordChanges(recordType: string, recordId: string) {
  return useRecordList('/audit/changes', AuditChangeSchema, auditChangeKeys, recordType, recordId);
}

/** One record's status transitions. */
export function useRecordStatusHistory(recordType: string, recordId: string) {
  return useRecordList('/audit/status-history', StatusHistorySchema, statusHistoryKeys, recordType, recordId);
}
