import { Dec } from '@/lib/money';

import type { Contract, ContractInput } from './contractors';

/**
 * A contract as the form holds it while it is being filled (text and null, never a half-valid number), with the
 * checks that decide whether it can be sent, and the body it becomes. The Add New Contractor form uses the same
 * draft for the contractor's first contract.
 */
export interface ContractDraft {
  estate_id: string | null;
  reference_number: string;
  work_type: Contract['work_type'] | null;
  rate_basis: Contract['rate_basis'] | null;
  rate: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_value: string | null;
  retention_percentage: string | null;
  payment_terms: Contract['payment_terms'];
  work_location: Contract['work_location'];
  reporting_to_designation_id: string | null;
  terms: string;
}

export const emptyDraft: ContractDraft = {
  estate_id: null,
  reference_number: '',
  work_type: null,
  rate_basis: null,
  rate: null,
  start_date: null,
  end_date: null,
  contract_value: null,
  retention_percentage: null,
  payment_terms: null,
  work_location: null,
  reporting_to_designation_id: null,
  terms: '',
};

/** The draft of an existing contract (to change it, or to renew from it). */
export function draftOf(contract: Contract): ContractDraft {
  return {
    estate_id: contract.estate_id,
    reference_number: contract.reference_number ?? '',
    work_type: contract.work_type,
    rate_basis: contract.rate_basis,
    rate: contract.rate,
    start_date: contract.start_date,
    end_date: contract.end_date,
    contract_value: contract.contract_value,
    retention_percentage: contract.retention_percentage,
    payment_terms: contract.payment_terms,
    work_location: contract.work_location,
    reporting_to_designation_id: contract.reporting_to_designation_id,
    terms: contract.terms ?? '',
  };
}

/** The messages a contract check can give, already in the user's language. */
export interface ContractMessages {
  readonly required: string;
  readonly endBeforeStart: string;
  readonly valueForLumpSum: string;
  readonly retention: string;
}

/** What is wrong with a draft, by field; empty when it can be sent. */
export function checkDraft(d: ContractDraft, m: ContractMessages): Record<string, string> {
  const errors: Record<string, string> = {};
  if (d.estate_id === null) errors.estate_id = m.required;
  if (d.work_type === null) errors.work_type = m.required;
  if (d.rate_basis === null) errors.rate_basis = m.required;
  if (d.rate === null) errors.rate = m.required;
  if (d.start_date === null) errors.start_date = m.required;
  if (d.end_date === null) errors.end_date = m.required;
  if (d.start_date !== null && d.end_date !== null && d.end_date < d.start_date)
    errors.end_date = m.endBeforeStart;
  if (d.rate_basis === 'lump_sum' && d.contract_value === null) errors.contract_value = m.valueForLumpSum;
  if (d.retention_percentage !== null) {
    const retention = new Dec(d.retention_percentage);
    if (retention.lt(0) || retention.gt(100)) errors.retention_percentage = m.retention;
  }
  return errors;
}

/** The body a valid draft sends. */
export function inputOf(d: ContractDraft): ContractInput {
  return {
    estate_id: d.estate_id ?? '',
    reference_number: d.reference_number.trim() === '' ? null : d.reference_number.trim(),
    work_type: d.work_type ?? 'other',
    rate_basis: d.rate_basis ?? 'per_day',
    rate: d.rate ?? '0',
    start_date: d.start_date ?? '',
    end_date: d.end_date ?? '',
    contract_value: d.contract_value,
    retention_percentage: d.retention_percentage,
    payment_terms: d.payment_terms,
    work_location: d.work_location,
    reporting_to_designation_id: d.reporting_to_designation_id,
    terms: d.terms.trim() === '' ? null : d.terms.trim(),
  };
}
