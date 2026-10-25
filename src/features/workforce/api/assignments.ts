import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation } from '@/lib/query';

import { profileKeys } from './profiles';

/**
 * Employment assignments (P2.03): where and on what terms a profile works from a date. A transfer, promotion,
 * demotion or wage revision is a NEW assignment from its date; nothing is edited once submitted. A change in pay
 * waits for approval; any other change is in effect when it is submitted.
 */

export const WAGE_BASES = ['daily', 'monthly', 'hourly', 'piece_rate', 'quantity', 'fixed'] as const;
export const CHANGE_REASONS = [
  'joining',
  'transfer',
  'promotion',
  'demotion',
  'wage_revision',
  'other',
] as const;
export const ASSIGNMENT_STATES = ['draft', 'submitted', 'approved', 'rejected'] as const;
/** The design's Salary & Payroll lines, in its order. */
export const PAY_COMPONENTS = ['basic', 'house_rent', 'medical', 'conveyance', 'other'] as const;

const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });
const Text = z.string().nullable();
const Who = z.looseObject({ id: z.string(), username: z.string() });

export const AssignmentSchema = z.looseObject({
  id: z.string(),
  employment_profile_id: z.string(),
  estate_id: z.string(),
  department_id: Text,
  department: Ref.nullable(),
  designation_id: Text,
  designation: Ref.nullable(),
  division_id: Text,
  division: Ref.nullable(),
  section_id: Text,
  section: Ref.nullable(),
  activity_type_id: Text,
  activity_type: Ref.nullable(),
  default_shift_id: Text,
  default_shift: Ref.nullable(),
  wage_basis: z.enum(WAGE_BASES),
  base_rate: Text,
  pay_lines: z.array(z.looseObject({ component: z.enum(PAY_COMPONENTS), amount: z.string() })),
  total_pay: Text,
  effective_from: z.string(),
  effective_to: Text,
  change_reason: z.enum(CHANGE_REASONS),
  remarks: Text,
  is_wage_change: z.boolean(),
  is_retrospective: z.boolean(),
  state: z.enum(ASSIGNMENT_STATES),
  is_current: z.boolean(),
  approval_id: Text,
  submitted_by: Who.nullable(),
  approved_by: Who.nullable(),
  rejection_reason: Text,
  version: z.number().int(),
});
export type Assignment = z.infer<typeof AssignmentSchema>;
export type PayComponent = (typeof PAY_COMPONENTS)[number];

const assignmentKeys = createQueryKeys('employment-assignments');
const timelineKey = (profileId: string) => assignmentKeys.sub(profileId, 'timeline');

/** A profile's timeline, latest first: the ones in effect, the pending change and the rejected ones. */
export function useAssignments(profileId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: timelineKey(profileId),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/employment-profiles/${profileId}/assignments`, {
          schema: z.array(AssignmentSchema),
          signal,
        })
      ).data,
  });
}

/** What the form sends; a field left out is copied from the current assignment, `null` clears one. */
export interface AssignmentInput {
  readonly effective_from: string;
  readonly change_reason: Assignment['change_reason'];
  readonly department_id: string | null;
  readonly designation_id: string | null;
  readonly section_id: string | null;
  readonly activity_type_id: string | null;
  readonly default_shift_id: string | null;
  readonly wage_basis: Assignment['wage_basis'];
  readonly base_rate: string | null;
  readonly pay_lines: readonly { readonly component: PayComponent; readonly amount: string }[];
  readonly remarks: string | null;
}

/** Everything a change touches: the timeline, the profile itself (its current assignment) and the lists. */
const touched = (profileId: string) => () => [timelineKey(profileId), profileKeys.all];

/** Start a change (employment.create): a draft until it is submitted. */
export function useStartAssignment(profileId: string) {
  return useApiMutation({
    mutationFn: async (input: AssignmentInput) =>
      (await api.post(`/employment-profiles/${profileId}/assignments`, input, { schema: AssignmentSchema }))
        .data,
    invalidates: touched(profileId),
  });
}

/** Change a draft (employment.edit); a submitted or approved assignment is never edited. */
export function useChangeAssignment(profileId: string, subject: string) {
  return useApiMutation({
    mutationFn: async ({
      assignment,
      input,
    }: {
      assignment: Pick<Assignment, 'id' | 'version'>;
      input: AssignmentInput;
    }) =>
      (
        await api.put(`/employment-assignments/${assignment.id}`, input, {
          schema: AssignmentSchema,
          ifMatch: assignment.version,
        })
      ).data,
    invalidates: touched(profileId),
    conflictSubject: () => subject,
  });
}

/**
 * Submit a draft (employment.create), given as it was last read: in effect at once, or waiting for approval when it
 * changes pay (the answer says which: `state` and `approval_id`).
 */
export function useSubmitAssignment(profileId: string, subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (assignment: Pick<Assignment, 'id' | 'version'>) =>
      (
        await api.post(`/employment-assignments/${assignment.id}/submit`, undefined, {
          schema: AssignmentSchema,
          versioned: true,
          ifMatch: assignment.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: touched(profileId),
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

/** Delete a draft (employment.delete). */
export function useDeleteAssignment(profileId: string, assignment: Pick<Assignment, 'id'>) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/employment-assignments/${assignment.id}`);
    },
    invalidates: touched(profileId),
  });
}
