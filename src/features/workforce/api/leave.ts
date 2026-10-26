import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { isApiError } from '@/lib/errors';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Leave (P2.07): what each person is entitled to in a fiscal year (the balances), and the requests for leave: drafted,
 * submitted to a supervisor, approved (the balance drops) and, if need be, cancelled (it comes back). Everyone files and
 * follows their own leave; those who may approve see and adjust the rest.
 */

export const LEAVE_STATES = ['draft', 'submitted', 'approved', 'rejected', 'cancelled'] as const;

const Text = z.string().nullable();
const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });
const ProfileRef = z.looseObject({ id: z.string(), profile_number: z.string(), full_name: z.string() });

export const LeaveSchema = z.looseObject({
  id: z.string(),
  request_number: z.string(),
  employment_profile_id: z.string(),
  profile: ProfileRef,
  estate_id: z.string(),
  leave_type_id: z.string(),
  leave_type: Ref,
  from_date: z.string(),
  to_date: z.string(),
  day_count: z.string(),
  is_half_day: z.boolean(),
  is_paid: z.boolean(),
  reason: Text,
  contact_during_leave: Text,
  covering_profile_id: Text,
  covering: ProfileRef.nullable(),
  leave_entitlement_id: Text,
  balance_days: Text,
  state: z.enum(LEAVE_STATES),
  approval_id: Text,
  rejection_reason: Text,
  cancellation_reason: Text,
  approved_at: Text,
  cancelled_at: Text,
  created_by: z.looseObject({ id: z.string(), username: z.string() }),
  version: z.number().int(),
  created_at: z.string(),
});
export type Leave = z.infer<typeof LeaveSchema>;

export const EntitlementSchema = z.looseObject({
  id: z.string(),
  employment_profile_id: z.string(),
  profile: ProfileRef,
  leave_type_id: z.string(),
  leave_type: Ref,
  fiscal_year_id: z.string(),
  fiscal_year: z.looseObject({ id: z.string(), code: z.string() }),
  entitled_days: z.string(),
  carried_forward_days: z.string(),
  adjustment_days: z.string(),
  adjustment_reason: Text,
  total_available: z.string(),
  consumed_days: z.string(),
  encashed_days: z.string(),
  pending_days: z.string(),
  balance_days: z.string(),
  available_to_request: z.string(),
  allows_negative_balance: z.boolean(),
  version: z.number().int(),
});
export type Entitlement = z.infer<typeof EntitlementSchema>;

export const leaveKeys = createQueryKeys('leave-requests');
export const entitlementKeys = createQueryKeys('leave-entitlements');

/** The numbers of a refusal for a balance that does not cover a request (INSUFFICIENT_BALANCE). */
export interface BalanceProblem {
  readonly balance_days: string;
  readonly pending_days: string;
  readonly available_days: string;
  readonly requested_days: string;
}

/** The balance numbers the server sends with INSUFFICIENT_BALANCE, when it is that refusal. */
export function balanceProblemOf(error: unknown): BalanceProblem | null {
  if (!isApiError(error) || error.code !== 'INSUFFICIENT_BALANCE') return null;
  const context = error.details[0]?.context;
  if (!context) return null;
  const pick = (key: string) => (typeof context[key] === 'string' ? context[key] : '');
  return {
    balance_days: pick('balance_days'),
    pending_days: pick('pending_days'),
    available_days: pick('available_days'),
    requested_days: pick('requested_days'),
  };
}

// ---- Requests ---------------------------------------------------------------------------------------------

/** The leave register: the requests the user may see, newest first; filters come from the URL. */
export function useLeaveList() {
  return usePagedList({
    keys: leaveKeys,
    path: '/leave-requests',
    row: LeaveSchema,
    defaultSort: '-created_at',
    pageSize: 25,
  });
}

export function useLeave(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: leaveKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/leave-requests/${id}`, { schema: LeaveSchema, signal })).data,
  });
}

/** What the leave form sends; `employment_profile_id` is left out for one's own leave. */
export interface LeaveInput {
  readonly employment_profile_id?: string;
  readonly leave_type_id: string;
  readonly from_date: string;
  readonly to_date: string;
  readonly is_half_day: boolean;
  readonly reason: string | null;
  readonly contact_during_leave: string | null;
  readonly covering_profile_id: string | null;
}

/** A request changes balances and the lists of leave. */
const touched = () => [leaveKeys.all, entitlementKeys.all];

export function useCreateLeave() {
  return useApiMutation({
    mutationFn: async (input: LeaveInput) =>
      (await api.post('/leave-requests', input, { schema: LeaveSchema })).data,
    invalidates: touched,
  });
}

/** Change a draft (the employee never changes). */
export function useChangeLeave(subject: string) {
  return useApiMutation({
    mutationFn: async ({
      leave,
      input,
    }: {
      leave: Pick<Leave, 'id' | 'version'>;
      input: Omit<LeaveInput, 'employment_profile_id'>;
    }) =>
      (
        await api.patch(`/leave-requests/${leave.id}`, input, {
          schema: LeaveSchema,
          ifMatch: leave.version,
        })
      ).data,
    invalidates: touched,
    conflictSubject: () => subject,
  });
}

/** Submit a draft: refused with INSUFFICIENT_BALANCE (and the numbers) when it does not fit the balance. */
export function useSubmitLeave(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (leave: Pick<Leave, 'id' | 'version'>) =>
      (
        await api.post(`/leave-requests/${leave.id}/submit`, undefined, {
          schema: LeaveSchema,
          versioned: true,
          ifMatch: leave.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: touched,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

/** Cancel approved leave, with the reason: the balance comes back. */
export function useCancelLeave(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { leave: Pick<Leave, 'id' | 'version'>; reason: string }) =>
      (
        await api.post(
          `/leave-requests/${input.leave.id}/cancel`,
          { reason: input.reason },
          {
            schema: LeaveSchema,
            versioned: true,
            ifMatch: input.leave.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: touched,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteLeave() {
  return useApiMutation({
    mutationFn: async (leave: Pick<Leave, 'id'>) => {
      await api.delete(`/leave-requests/${leave.id}`);
    },
    invalidates: () => [leaveKeys.lists(), entitlementKeys.all],
  });
}

// ---- Balances ---------------------------------------------------------------------------------------------

export interface EntitlementFilters {
  readonly fiscalYearId?: string;
  readonly estateId?: string;
  readonly profileId?: string;
}

/** Balances per person and leave type for a year; a worker gets only their own. */
export function useEntitlements(filters: EntitlementFilters) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: entitlementKeys.list(JSON.stringify(filters)),
    queryFn: async ({ signal }) =>
      (
        await api.get('/leave-entitlements', {
          query: {
            ...(filters.fiscalYearId ? { 'filter[fiscal_year_id]': filters.fiscalYearId } : {}),
            ...(filters.estateId ? { 'filter[estate_id]': filters.estateId } : {}),
            ...(filters.profileId ? { 'filter[employment_profile_id]': filters.profileId } : {}),
            per_page: 200,
          },
          schema: z.array(EntitlementSchema),
          signal,
        })
      ).data,
  });
}

/** Create the year's entitlements for a garden or one person (those that exist are left alone). */
export function useGenerateEntitlements() {
  return useApiMutation({
    mutationFn: async (input: {
      fiscal_year_id: string;
      estate_id?: string;
      employment_profile_id?: string;
    }) =>
      (
        await api.post('/leave-entitlements/generate', input, {
          schema: z.looseObject({ created: z.number().int(), existing: z.number().int() }),
        })
      ).data,
    invalidates: () => [entitlementKeys.all],
  });
}

/** Replace an entitlement's adjustment (leave.approve): days, which may be negative, and why. */
export function useAdjustEntitlement(entitlement: Pick<Entitlement, 'id' | 'version'>, subject: string) {
  return useApiMutation({
    mutationFn: async (input: { adjustment_days: string; reason: string }) =>
      (
        await api.post(`/leave-entitlements/${entitlement.id}/adjust`, input, {
          schema: EntitlementSchema,
          versioned: true,
          ifMatch: entitlement.version,
        })
      ).data,
    invalidates: () => [entitlementKeys.all],
    conflictSubject: () => subject,
  });
}
