import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Notifications (P1.16): the signed-in user's own (the bell, the list, mark read, dismiss) and the notification rules
 * that decide who is told what (Admin). Someone else's notification is 404. The summary behind the bell is polled
 * every minute; the lists are refetched when its `latest_at` moves.
 */

export const notificationKeys = createQueryKeys('notifications');
export const ruleKeys = createQueryKeys('notification-rules');

export const SEVERITIES = ['info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const TRIGGER_TYPES = [
  'approval_pending',
  'approval_unresolved',
  'document_expiry',
  'access_review',
  'budget_threshold',
  'payment_due',
  'abnormal_yield',
  'low_stock',
  'contract_expiry',
  'lease_due',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const RECIPIENT_RULES = ['approvers', 'by_role', 'by_scope', 'by_named_user'] as const;
export type RecipientRule = (typeof RECIPIENT_RULES)[number];

export const CHANNELS = ['in_app', 'email'] as const;
export type Channel = (typeof CHANNELS)[number];

export const NotificationSchema = z.looseObject({
  id: z.string(),
  subject: z.string(),
  body: z.string(),
  severity: z.enum(SEVERITIES),
  link: z.object({ type: z.string(), id: z.string(), route: z.string() }),
  rule: z.object({ code: z.string(), name: z.string(), trigger_type: z.enum(TRIGGER_TYPES) }),
  occurred_on: z.string(),
  created_at: z.string(),
  is_read: z.boolean(),
  read_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
  email: z.object({
    state: z.enum(['not_required', 'pending', 'sending', 'sent', 'failed', 'skipped']),
    delivered_at: z.string().nullable(),
    error: z.string().nullable(),
  }),
});
export type AppNotification = z.infer<typeof NotificationSchema>;

const SummarySchema = z.object({
  unread: z.number().int(),
  unread_critical: z.number().int(),
  latest_at: z.string().nullable(),
});

/**
 * The bell's numbers: unread (not read and not dismissed) and how many of them are critical. Polled every minute; when
 * the newest notification's time changes, the lists are fetched again.
 */
export function useNotificationSummary() {
  const client = useQueryClient();
  const query = useQuery({
    ...cachePolicy('live'),
    queryKey: [...notificationKeys.all, 'summary'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/notifications/summary', { schema: SummarySchema, signal })).data,
  });
  const latest = query.data?.latest_at;
  const seen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (latest === undefined) return;
    if (seen.current !== undefined && seen.current !== latest) {
      void client.invalidateQueries({ queryKey: notificationKeys.lists() });
      void client.invalidateQueries({ queryKey: [...notificationKeys.all, 'recent'] });
    }
    seen.current = latest;
  }, [latest, client]);
  return query;
}

/** The user's notifications, newest first, with filters from the URL (`filter[is_read]`, `filter[is_dismissed]` …). */
export function useNotificationsList() {
  return usePagedList({
    keys: notificationKeys,
    path: '/notifications',
    row: NotificationSchema,
    policy: 'live',
    pageSize: 25,
  });
}

/** The newest few, for the bell's panel. */
export function useRecentNotifications(enabled: boolean) {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: [...notificationKeys.all, 'recent'] as const,
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get('/notifications', {
          query: { per_page: 8 },
          schema: z.array(NotificationSchema),
          signal,
        })
      ).data,
  });
}

export type NotificationAction = 'read' | 'unread' | 'dismiss' | 'restore';

/** Mark one read or unread, or dismiss (which also marks it read) or restore it. All are safe to repeat. */
export function useNotificationAction() {
  return useApiMutation({
    mutationFn: async (input: { id: string; action: NotificationAction }) =>
      (
        await api.post(`/notifications/${input.id}/${input.action}`, undefined, {
          schema: NotificationSchema,
        })
      ).data,
    invalidates: () => [notificationKeys.all],
  });
}

/** Mark read everything up to the newest one shown, so one arriving meanwhile stays unread. */
export function useReadAll() {
  return useApiMutation({
    mutationFn: async (input: { upToId: string | null }) =>
      (
        await api.post('/notifications/read-all', input.upToId === null ? {} : { up_to_id: input.upToId }, {
          schema: z.object({ marked_read: z.number().int() }),
        })
      ).data,
    invalidates: () => [notificationKeys.all],
  });
}

// ---- Notification rules (Admin) ------------------------------------------------------------------------

const TriggerSchema = z.looseObject({
  key: z.enum(TRIGGER_TYPES),
  label: z.string(),
  description: z.string(),
  recipient_rules: z.array(z.enum(RECIPIENT_RULES)),
  uses_lead_days: z.boolean(),
  evaluated: z.boolean(),
  arrives_with: z.string().nullable(),
});
export type Trigger = z.infer<typeof TriggerSchema>;

export const RuleSchema = z.looseObject({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  trigger_type: z.enum(TRIGGER_TYPES),
  trigger: TriggerSchema,
  condition: z.record(z.string(), z.unknown()).nullable(),
  lead_days: z.number().int().nullable(),
  recipient_rule: z.enum(RECIPIENT_RULES),
  role: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
  user: z.object({ id: z.string(), username: z.string() }).nullable(),
  channel: z.enum(CHANNELS),
  severity: z.enum(SEVERITIES),
  is_active: z.boolean(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Rule = z.infer<typeof RuleSchema>;

export function useRulesList() {
  return usePagedList({ keys: ruleKeys, path: '/notification-rules', row: RuleSchema, pageSize: 25 });
}

/** What each trigger allows: its recipient rules, whether lead days apply, and whether anything evaluates it yet. */
export function useTriggers() {
  return useQuery({
    ...cachePolicy('reference'),
    queryKey: [...ruleKeys.all, 'triggers'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/notification-rules/triggers', { schema: z.array(TriggerSchema), signal })).data,
  });
}

export interface RuleBody {
  readonly name: string;
  readonly description: string | null;
  readonly condition: Record<string, unknown> | null;
  readonly lead_days: number | null;
  readonly recipient_rule: RecipientRule;
  readonly role_id: string | null;
  readonly user_id: string | null;
  readonly channel: Channel;
  readonly severity: Severity;
  readonly is_active: boolean;
}

/** Add a rule (notification.create). There is no delete: a rule is deactivated. 422 DUPLICATE_KEY: the code is used. */
export function useCreateRule() {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: RuleBody & { code: string; trigger_type: TriggerType }) =>
      (
        await api.post('/notification-rules', input, {
          schema: RuleSchema,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [ruleKeys.all],
    onSuccess: idempotency.reset,
  });
}

/** Change a rule (notification.edit) with the version read; its code and trigger are fixed. */
export function useUpdateRule(rule: Pick<Rule, 'id' | 'version' | 'name'>) {
  return useApiMutation({
    mutationFn: async (input: Partial<RuleBody>) =>
      (
        await api.patch(`/notification-rules/${rule.id}`, input, {
          schema: RuleSchema,
          ifMatch: rule.version,
        })
      ).data,
    invalidates: () => [ruleKeys.all],
    conflictSubject: () => rule.name,
  });
}
