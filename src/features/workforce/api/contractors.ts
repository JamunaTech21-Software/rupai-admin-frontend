import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import { MOBILE_BANKING, RELATIONS } from './schemas';

/**
 * Contractors (P2.05): who supplies labour and services, their contracts (each approved before it counts), and the
 * labour on a contract. A contractor's status comes from the server (active, inactive, blacklisted); a contract's
 * status is worked out from its state and dates (pending, upcoming, active, completed, terminated, rejected).
 */

export const CONTRACTOR_TYPES = ['individual', 'company', 'supplier'] as const;
export const LEGAL_STATUSES = [
  'proprietorship',
  'partnership',
  'private_ltd',
  'public_ltd',
  'other',
] as const;
export const SAFETY_COMPLIANCE = ['compliant', 'partially_compliant', 'non_compliant'] as const;
export const QUALITY_RATINGS = ['excellent', 'good', 'average', 'poor'] as const;
export const CONTRACTOR_STATUSES = ['active', 'inactive', 'blacklisted'] as const;
export const WORK_TYPES = [
  'labour_supply',
  'plucking',
  'field_work',
  'construction',
  'transport',
  'service',
  'other',
] as const;
export const RATE_BASES = ['per_day', 'per_kg', 'per_unit', 'lump_sum'] as const;
export const PAYMENT_TERMS = ['advance', 'monthly', 'quarterly', 'milestone'] as const;
export const WORK_LOCATIONS = ['estate', 'factory', 'office', 'field'] as const;
export const CONTRACT_STATES = ['draft', 'submitted', 'approved', 'rejected', 'terminated'] as const;
export const CONTRACT_STATUSES = [
  'pending',
  'active',
  'upcoming',
  'completed',
  'terminated',
  'rejected',
] as const;

const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });
const Text = z.string().nullable();

const ContractSummary = z.looseObject({
  id: z.string(),
  contract_number: z.string(),
  estate: Ref,
  work_type: z.enum(WORK_TYPES),
  start_date: z.string(),
  end_date: z.string(),
  contract_value: Text,
  work_location: z.enum(WORK_LOCATIONS).nullable(),
  division: Ref.nullable(),
  status: z.enum(CONTRACT_STATUSES),
});

export const ContractorSchema = z.looseObject({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  short_name: Text,
  contractor_type: z.enum(CONTRACTOR_TYPES),
  trade_category_id: Text,
  trade_category: Ref.nullable(),
  legal_status: z.enum(LEGAL_STATUSES).nullable(),
  registration_type: Text,
  contractor_since: Text,
  description: Text,
  contact_person: Text,
  designation: Text,
  phone: Text,
  phone_alt: Text,
  email: Text,
  address_line1: Text,
  present_district: Text,
  present_upazila: Text,
  present_postal_code: Text,
  permanent_address: Text,
  permanent_district: Text,
  permanent_upazila: Text,
  permanent_postal_code: Text,
  national_id: Text,
  registration_number: Text,
  trade_licence_number: Text,
  trade_licence_expiry: Text,
  licence_expiring: z.boolean(),
  bin: Text,
  tin: Text,
  vat_registration_number: Text,
  registration_date: Text,
  renewal_date: Text,
  bank_name: Text,
  bank_branch: Text,
  bank_account_name: Text,
  bank_account_number: Text,
  bank_routing_number: Text,
  mobile_banking_provider: z.enum(MOBILE_BANKING).nullable(),
  mobile_banking_number: Text,
  equipment_owned: Text,
  years_of_experience: z.number().int().nullable(),
  safety_compliance: z.enum(SAFETY_COMPLIANCE).nullable(),
  quality_rating: z.enum(QUALITY_RATINGS).nullable(),
  remarks: Text,
  emergency_contact_name: Text,
  emergency_relation: z.enum(RELATIONS).nullable(),
  emergency_phone: Text,
  emergency_phone_alt: Text,
  emergency_address: Text,
  registered_estate_id: Text,
  current_contract: ContractSummary.nullable(),
  number_of_workers: z.number().int(),
  status: z.enum(CONTRACTOR_STATUSES),
  blacklist_reason: Text,
  version: z.number().int(),
  created_at: z.string(),
  updated_at: Text,
});
export type Contractor = z.infer<typeof ContractorSchema>;

export const ContractSchema = z.looseObject({
  id: z.string(),
  contractor_id: z.string(),
  contractor: z.looseObject({ id: z.string(), code: z.string(), name: z.string() }),
  estate_id: z.string(),
  estate: Ref,
  contract_number: z.string(),
  reference_number: Text,
  work_type: z.enum(WORK_TYPES),
  rate_basis: z.enum(RATE_BASES),
  rate: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  duration_months: z.number().int(),
  days_left: z.number().int(),
  contract_value: Text,
  retention_percentage: Text,
  payment_terms: z.enum(PAYMENT_TERMS).nullable(),
  work_location: z.enum(WORK_LOCATIONS).nullable(),
  division_id: Text,
  division: Ref.nullable(),
  reporting_to_designation_id: Text,
  reporting_to: Ref.nullable(),
  terms: Text,
  state: z.enum(CONTRACT_STATES),
  status: z.enum(CONTRACT_STATUSES),
  approval_id: Text,
  labour_count: z.number().int(),
  terminated_on: Text,
  termination_reason: Text,
  rejection_reason: Text,
  version: z.number().int(),
  created_at: z.string(),
});
export type Contract = z.infer<typeof ContractSchema>;

export const LabourSchema = z.looseObject({
  id: z.string(),
  contractor_contract_id: z.string(),
  labour_code: z.string(),
  name: z.string(),
  national_id: Text,
  phone: Text,
  engaged_from: Text,
  engaged_to: Text,
  status: z.enum(['active', 'inactive']),
  version: z.number().int(),
});
export type Labour = z.infer<typeof LabourSchema>;

const Bucket = z.looseObject({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
  percentage: z.string(),
});
export type ContractorBucket = z.infer<typeof Bucket>;

export const ContractorSummarySchema = z.looseObject({
  total: z.number().int(),
  active: z.number().int(),
  inactive: z.number().int(),
  blacklisted: z.number().int(),
  contracts_expiring: z.number().int(),
  expiring_days: z.number().int(),
  new_this_month: z.number().int(),
  total_contract_value: z.string(),
  by_contractor_type: z.array(Bucket),
  by_work_type: z.array(Bucket),
  by_trade_category: z.array(Bucket),
  by_status: z.array(Bucket),
  top_contractors: z.array(
    z.looseObject({
      contractor_id: z.string(),
      code: z.string(),
      name: z.string(),
      contract_value: z.string(),
    }),
  ),
  expiry_alerts: z.array(
    z.looseObject({
      contract_id: z.string(),
      contract_number: z.string(),
      contractor_id: z.string(),
      contractor_name: z.string(),
      end_date: z.string(),
      days_left: z.number().int(),
      status: z.enum(['expired', 'expiring_soon', 'safe']),
    }),
  ),
  licences_expiring: z.number().int(),
});
export type ContractorSummary = z.infer<typeof ContractorSummarySchema>;

export const contractorKeys = createQueryKeys('contractors');
export const contractKeys = createQueryKeys('contractor-contracts');

// ---- Contractors ------------------------------------------------------------------------------------------

export function useContractorsList() {
  return usePagedList({
    keys: contractorKeys,
    path: '/contractors',
    row: ContractorSchema,
    defaultSort: 'name',
    pageSize: 25,
  });
}

export function useContractor(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: contractorKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/contractors/${id}`, { schema: ContractorSchema, signal })).data,
  });
}

/** The cards, charts and alerts of Contractor Management, for an estate when one is chosen. */
export function useContractorSummary(estateId: string | undefined) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: contractorKeys.sub('summary', estateId ?? 'all'),
    queryFn: async ({ signal }) =>
      (
        await api.get('/contractors/summary', {
          query: estateId ? { estate_id: estateId } : {},
          schema: ContractorSummarySchema,
          signal,
        })
      ).data,
  });
}

/** The fields a contractor keeps; what Save sends (the code is kept as it is once made). */
export interface ContractorInput {
  readonly name: string;
  readonly short_name: string | null;
  readonly contractor_type: Contractor['contractor_type'];
  readonly trade_category_id: string;
  readonly legal_status: Contractor['legal_status'];
  readonly registration_type: string | null;
  readonly contractor_since: string | null;
  readonly description: string | null;
  readonly phone: string;
  readonly phone_alt: string | null;
  readonly email: string | null;
  readonly address_line1: string;
  readonly present_district: string;
  readonly present_upazila: string | null;
  readonly present_postal_code: string | null;
  readonly permanent_address: string | null;
  readonly permanent_district: string | null;
  readonly permanent_upazila: string | null;
  readonly permanent_postal_code: string | null;
  readonly national_id: string | null;
  readonly registration_number: string | null;
  readonly trade_licence_number: string;
  readonly trade_licence_expiry: string | null;
  readonly bin: string | null;
  readonly tin: string | null;
  readonly vat_registration_number: string | null;
  readonly registration_date: string | null;
  readonly renewal_date: string | null;
  readonly bank_name: string;
  readonly bank_branch: string;
  readonly bank_account_name: string;
  readonly bank_account_number: string;
  readonly bank_routing_number: string | null;
  readonly mobile_banking_provider: Contractor['mobile_banking_provider'];
  readonly mobile_banking_number: string | null;
  readonly equipment_owned: string | null;
  readonly years_of_experience: number | null;
  readonly safety_compliance: Contractor['safety_compliance'];
  readonly quality_rating: Contractor['quality_rating'];
  readonly remarks: string | null;
  readonly emergency_contact_name: string;
  readonly emergency_relation: NonNullable<Contractor['emergency_relation']>;
  readonly emergency_phone: string;
  readonly emergency_phone_alt: string | null;
  readonly emergency_address: string | null;
}

/** What a contract form sends (the same fields start a contractor's first contract). */
export interface ContractInput {
  readonly estate_id: string;
  readonly reference_number: string | null;
  readonly work_type: Contract['work_type'];
  readonly rate_basis: Contract['rate_basis'];
  readonly rate: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly contract_value: string | null;
  readonly retention_percentage: string | null;
  readonly payment_terms: Contract['payment_terms'];
  readonly work_location: Contract['work_location'];
  readonly reporting_to_designation_id: string | null;
  readonly terms: string | null;
}

export interface NewContractorInput extends ContractorInput {
  readonly code?: string;
  readonly registered_estate_id: string | null;
  /** Becomes the primary contact. */
  readonly contact_person: {
    readonly contact_name: string;
    readonly designation: string | null;
    readonly phone: string;
    readonly email: string | null;
  };
  /** Becomes the contractor's first contract, a draft. */
  readonly first_contract?: ContractInput;
}

export function useCreateContractor() {
  return useApiMutation({
    mutationFn: async (input: NewContractorInput) =>
      (await api.post('/contractors', input, { schema: ContractorSchema })).data,
    invalidates: () => [contractorKeys.all, contractKeys.all],
  });
}

export function useUpdateContractor(contractor: Pick<Contractor, 'id' | 'version' | 'name'>) {
  return useApiMutation({
    mutationFn: async (input: ContractorInput & { code: string }) =>
      (
        await api.put(`/contractors/${contractor.id}`, input, {
          schema: ContractorSchema,
          ifMatch: contractor.version,
        })
      ).data,
    invalidates: () => [contractorKeys.all],
    conflictSubject: () => contractor.name,
  });
}

/** Blacklist (contractor.approve) with the reason. */
export function useBlacklist(contractor: Pick<Contractor, 'id' | 'version' | 'name'>) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (reason: string) =>
      (
        await api.post(
          `/contractors/${contractor.id}/blacklist`,
          { reason },
          {
            schema: ContractorSchema,
            versioned: true,
            ifMatch: contractor.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [contractorKeys.all, contractKeys.all],
    conflictSubject: () => contractor.name,
    onSuccess: idempotency.reset,
  });
}

// ---- Contracts --------------------------------------------------------------------------------------------

export function useContractorContracts(contractorId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: contractKeys.sub(contractorId, 'of-contractor'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/contractors/${contractorId}/contracts`, {
          schema: z.array(ContractSchema),
          signal,
        })
      ).data,
  });
}

const contractsTouched = () => [contractKeys.all, contractorKeys.all];

export function useCreateContract(contractorId: string) {
  return useApiMutation({
    mutationFn: async (input: ContractInput) =>
      (
        await api.post(
          '/contractor-contracts',
          { ...input, contractor_id: contractorId },
          { schema: ContractSchema },
        )
      ).data,
    invalidates: contractsTouched,
  });
}

/** Change a draft contract (contractor.edit). */
export function useChangeContract(subject: string) {
  return useApiMutation({
    mutationFn: async ({
      contract,
      input,
    }: {
      contract: Pick<Contract, 'id' | 'version'>;
      input: ContractInput;
    }) =>
      (
        await api.patch(`/contractor-contracts/${contract.id}`, input, {
          schema: ContractSchema,
          ifMatch: contract.version,
        })
      ).data,
    invalidates: contractsTouched,
    conflictSubject: () => subject,
  });
}

/** Send a draft for approval (contractor.create): the answer carries the approval to follow. */
export function useSubmitContract(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (contract: Pick<Contract, 'id' | 'version'>) =>
      (
        await api.post(`/contractor-contracts/${contract.id}/submit`, undefined, {
          schema: ContractSchema,
          versioned: true,
          ifMatch: contract.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: contractsTouched,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

/** End an approved contract early (contractor.approve): the last day of work and the reason. */
export function useTerminateContract(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: {
      contract: Pick<Contract, 'id' | 'version'>;
      terminated_on: string;
      reason: string;
    }) =>
      (
        await api.post(
          `/contractor-contracts/${input.contract.id}/terminate`,
          { terminated_on: input.terminated_on, reason: input.reason },
          {
            schema: ContractSchema,
            versioned: true,
            ifMatch: input.contract.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: contractsTouched,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteContract() {
  return useApiMutation({
    mutationFn: async (contract: Pick<Contract, 'id'>) => {
      await api.delete(`/contractor-contracts/${contract.id}`);
    },
    invalidates: contractsTouched,
  });
}

// ---- Labour -----------------------------------------------------------------------------------------------

const labourKey = (contractId: string) => contractKeys.sub(contractId, 'labour');

export function useLabour(contractId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: labourKey(contractId),
    queryFn: async ({ signal }) =>
      (await api.get(`/contractor-contracts/${contractId}/labour`, { schema: z.array(LabourSchema), signal }))
        .data,
  });
}

export interface LabourInput {
  readonly name: string;
  readonly national_id: string | null;
  readonly phone: string | null;
  readonly engaged_from: string | null;
  readonly engaged_to: string | null;
}

const labourTouched = (contractId: string) => () => [
  labourKey(contractId),
  contractKeys.all,
  contractorKeys.all,
];

export function useAddLabour(contractId: string) {
  return useApiMutation({
    mutationFn: async (input: LabourInput) =>
      (await api.post(`/contractor-contracts/${contractId}/labour`, input, { schema: LabourSchema })).data,
    invalidates: labourTouched(contractId),
  });
}

export function useChangeLabour(contractId: string, subject: string) {
  return useApiMutation({
    mutationFn: async (input: {
      labour: Pick<Labour, 'id' | 'version'>;
      changes: Partial<LabourInput> & { status?: Labour['status'] };
    }) =>
      (
        await api.patch(`/contractor-contracts/${contractId}/labour/${input.labour.id}`, input.changes, {
          schema: LabourSchema,
          ifMatch: input.labour.version,
        })
      ).data,
    invalidates: labourTouched(contractId),
    conflictSubject: () => subject,
  });
}

export function useRemoveLabour(contractId: string) {
  return useApiMutation({
    mutationFn: async (labour: Pick<Labour, 'id'>) => {
      await api.delete(`/contractor-contracts/${contractId}/labour/${labour.id}`);
    },
    invalidates: labourTouched(contractId),
  });
}
