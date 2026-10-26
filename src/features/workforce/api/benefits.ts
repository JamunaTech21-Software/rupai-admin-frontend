import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Benefits and welfare (P2.08): what a person is entitled to besides pay (a ration card, a house), what has been issued
 * against it (this week's ration), and welfare cases (help for medical costs, education, disasters). An entitlement, an
 * issue and a welfare case are each approved before they count.
 */

export const ENTITLEMENT_STATES = ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] as const;
export const ISSUE_STATES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export const CASE_STATES = ['draft', 'submitted', 'approved', 'rejected', 'closed'] as const;
export const BENEFICIARY_TYPES = ['employment_profile', 'person', 'community'] as const;
export const WELFARE_CATEGORIES = [
  'medical',
  'education',
  'disaster',
  'bereavement',
  'community',
  'other',
] as const;

const Text = z.string().nullable();
const ProfileRef = z.looseObject({ id: z.string(), profile_number: z.string(), full_name: z.string() });
const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });

export const EntitlementSchema = z.looseObject({
  id: z.string(),
  employment_profile_id: z.string(),
  profile: ProfileRef,
  estate_id: z.string(),
  benefit_type_id: z.string(),
  benefit_type: Ref.extend({ benefit_category: z.string(), payroll_treatment: z.string() }),
  effective_from: z.string(),
  effective_to: Text,
  quantity_per_period: Text,
  employer_cost_per_period: Text,
  employee_contribution: z.string(),
  allocation_reference: Text,
  issuing_office: Text,
  withdrawal_reason: Text,
  state: z.enum(ENTITLEMENT_STATES),
  is_current: z.boolean(),
  approval_id: Text,
  rejection_reason: Text,
  version: z.number().int(),
});
export type BenefitEntitlement = z.infer<typeof EntitlementSchema>;

export const IssueSchema = z.looseObject({
  id: z.string(),
  benefit_entitlement_id: z.string(),
  profile: ProfileRef,
  benefit_type: Ref,
  estate_id: z.string(),
  issue_date: z.string(),
  period_reference: Text,
  quantity: Text,
  employer_cost: z.string(),
  employee_contribution: z.string(),
  state: z.enum(ISSUE_STATES),
  approval_id: Text,
  rejection_reason: Text,
  version: z.number().int(),
});
export type BenefitIssue = z.infer<typeof IssueSchema>;

export const CaseSchema = z.looseObject({
  id: z.string(),
  case_number: z.string(),
  estate_id: z.string(),
  beneficiary_type: z.enum(BENEFICIARY_TYPES),
  beneficiary_id: Text,
  beneficiary_name: Text,
  welfare_category: z.enum(WELFARE_CATEGORIES),
  case_date: z.string(),
  description: z.string(),
  requested_amount: Text,
  approved_amount: Text,
  disbursed_amount: z.string(),
  remaining_amount: Text,
  outcome: Text,
  state: z.enum(CASE_STATES),
  approval_id: Text,
  rejection_reason: Text,
  version: z.number().int(),
});
export type WelfareCase = z.infer<typeof CaseSchema>;

export const entitlementKeys = createQueryKeys('benefit-entitlements');
export const issueKeys = createQueryKeys('benefit-issues');
export const caseKeys = createQueryKeys('welfare-cases');

// ---- Entitlements -----------------------------------------------------------------------------------------

export function useEntitlementsList() {
  return usePagedList({
    keys: entitlementKeys,
    path: '/benefit-entitlements',
    row: EntitlementSchema,
    defaultSort: '-effective_from',
    pageSize: 25,
  });
}

/** One profile's entitlements (the Ration Card of a worker): newest first. */
export function useProfileEntitlements(profileId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: entitlementKeys.sub(profileId, 'of-profile'),
    queryFn: async ({ signal }) =>
      (
        await api.get('/benefit-entitlements', {
          query: { 'filter[employment_profile_id]': profileId, per_page: 100, sort: '-effective_from' },
          schema: z.array(EntitlementSchema),
          signal,
        })
      ).data,
  });
}

export interface EntitlementInput {
  readonly benefit_type_id: string;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly quantity_per_period: string | null;
  readonly employer_cost_per_period: string | null;
  readonly employee_contribution: string;
  readonly allocation_reference: string | null;
  readonly issuing_office: string | null;
}

const entitlementsTouched = () => [entitlementKeys.all, issueKeys.all];

export function useCreateEntitlement() {
  return useApiMutation({
    mutationFn: async (input: EntitlementInput & { employment_profile_id: string }) =>
      (await api.post('/benefit-entitlements', input, { schema: EntitlementSchema })).data,
    invalidates: entitlementsTouched,
  });
}

/** Change a draft (the person never changes). */
export function useChangeEntitlement(subject: string) {
  return useApiMutation({
    mutationFn: async (input: {
      entitlement: Pick<BenefitEntitlement, 'id' | 'version'>;
      changes: EntitlementInput;
    }) =>
      (
        await api.patch(`/benefit-entitlements/${input.entitlement.id}`, input.changes, {
          schema: EntitlementSchema,
          ifMatch: input.entitlement.version,
        })
      ).data,
    invalidates: entitlementsTouched,
    conflictSubject: () => subject,
  });
}

export function useSubmitEntitlement(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (entitlement: Pick<BenefitEntitlement, 'id' | 'version'>) =>
      (
        await api.post(`/benefit-entitlements/${entitlement.id}/submit`, undefined, {
          schema: EntitlementSchema,
          versioned: true,
          ifMatch: entitlement.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: entitlementsTouched,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

/** End an approved entitlement (benefit.approve): its last day and why. */
export function useWithdrawEntitlement(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: {
      entitlement: Pick<BenefitEntitlement, 'id' | 'version'>;
      effective_to: string;
      reason: string;
    }) =>
      (
        await api.post(
          `/benefit-entitlements/${input.entitlement.id}/withdraw`,
          { effective_to: input.effective_to, reason: input.reason },
          {
            schema: EntitlementSchema,
            versioned: true,
            ifMatch: input.entitlement.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: entitlementsTouched,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteEntitlement() {
  return useApiMutation({
    mutationFn: async (entitlement: Pick<BenefitEntitlement, 'id'>) => {
      await api.delete(`/benefit-entitlements/${entitlement.id}`);
    },
    invalidates: entitlementsTouched,
  });
}

// ---- Issues -----------------------------------------------------------------------------------------------

export function useIssuesList() {
  return usePagedList({
    keys: issueKeys,
    path: '/benefit-issues',
    row: IssueSchema,
    defaultSort: '-issue_date',
    pageSize: 25,
  });
}

/** Draft this period's issues for every current entitlement of a type in an estate (the week's ration). */
export function useGenerateIssues() {
  return useApiMutation({
    mutationFn: async (input: {
      benefit_type_id: string;
      estate_id: string;
      issue_date: string;
      period_reference: string | null;
    }) =>
      (
        await api.post('/benefit-issues/generate', input, {
          schema: z.looseObject({ created: z.number().int(), existing: z.number().int() }),
        })
      ).data,
    invalidates: () => [issueKeys.all],
  });
}

export function useSubmitIssue(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (issue: Pick<BenefitIssue, 'id' | 'version'>) =>
      (
        await api.post(`/benefit-issues/${issue.id}/submit`, undefined, {
          schema: IssueSchema,
          versioned: true,
          ifMatch: issue.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [issueKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteIssue() {
  return useApiMutation({
    mutationFn: async (issue: Pick<BenefitIssue, 'id'>) => {
      await api.delete(`/benefit-issues/${issue.id}`);
    },
    invalidates: () => [issueKeys.all],
  });
}

// ---- Welfare cases ----------------------------------------------------------------------------------------

export function useCasesList() {
  return usePagedList({
    keys: caseKeys,
    path: '/welfare-cases',
    row: CaseSchema,
    defaultSort: '-case_date',
    pageSize: 25,
  });
}

export function useCase(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: caseKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/welfare-cases/${id}`, { schema: CaseSchema, signal })).data,
  });
}

export interface CaseInput {
  readonly beneficiary_type: WelfareCase['beneficiary_type'];
  readonly beneficiary_id: string | null;
  readonly welfare_category: WelfareCase['welfare_category'];
  readonly case_date: string;
  readonly description: string;
  readonly requested_amount: string | null;
}

export function useCreateCase() {
  return useApiMutation({
    mutationFn: async (input: CaseInput & { estate_id: string }) =>
      (await api.post('/welfare-cases', input, { schema: CaseSchema })).data,
    invalidates: () => [caseKeys.all],
  });
}

export function useChangeCase(subject: string) {
  return useApiMutation({
    mutationFn: async (input: { welfareCase: Pick<WelfareCase, 'id' | 'version'>; changes: CaseInput }) =>
      (
        await api.patch(`/welfare-cases/${input.welfareCase.id}`, input.changes, {
          schema: CaseSchema,
          ifMatch: input.welfareCase.version,
        })
      ).data,
    invalidates: () => [caseKeys.all],
    conflictSubject: () => subject,
  });
}

/** Submit for approval; the case needs its requested amount. */
export function useSubmitCase(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (welfareCase: Pick<WelfareCase, 'id' | 'version'>) =>
      (
        await api.post(`/welfare-cases/${welfareCase.id}/submit`, undefined, {
          schema: CaseSchema,
          versioned: true,
          ifMatch: welfareCase.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [caseKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

/** Record a disbursement, up to what remains of the approved amount. */
export function useDisburse(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { welfareCase: Pick<WelfareCase, 'id' | 'version'>; amount: string }) =>
      (
        await api.post(
          `/welfare-cases/${input.welfareCase.id}/disburse`,
          { amount: input.amount },
          {
            schema: CaseSchema,
            versioned: true,
            ifMatch: input.welfareCase.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [caseKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useCloseCase(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { welfareCase: Pick<WelfareCase, 'id' | 'version'>; outcome: string }) =>
      (
        await api.post(
          `/welfare-cases/${input.welfareCase.id}/close`,
          { outcome: input.outcome },
          {
            schema: CaseSchema,
            versioned: true,
            ifMatch: input.welfareCase.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [caseKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteCase() {
  return useApiMutation({
    mutationFn: async (welfareCase: Pick<WelfareCase, 'id'>) => {
      await api.delete(`/welfare-cases/${welfareCase.id}`);
    },
    invalidates: () => [caseKeys.lists()],
  });
}
