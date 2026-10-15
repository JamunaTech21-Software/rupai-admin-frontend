import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import { ApprovalSchema, approvalKeys } from './approvals';

/**
 * Delegations and the approvals nobody can act on (P1.14, P7 §11): an administrator hands approval authority to
 * another user for a bounded period, with a reason, and ends it early; the exceptions list is where a step that
 * resolves to nobody waits for someone to be given its role.
 */

export const delegationKeys = createQueryKeys('approval-delegations');

const UserRef = z.object({ id: z.string(), username: z.string() });

export const DelegationSchema = z.looseObject({
  id: z.string(),
  from_user: UserRef,
  to_user: UserRef,
  document_type: z.string().nullable(),
  valid_from: z.string(),
  valid_to: z.string(),
  ended_at: z.string().nullable(),
  is_active: z.boolean(),
  reason: z.string(),
  created_by: z.string(),
  created_at: z.string(),
});
export type Delegation = z.infer<typeof DelegationSchema>;

export function useDelegations() {
  return usePagedList({
    keys: delegationKeys,
    path: '/approvals/delegations',
    row: DelegationSchema,
    pageSize: 25,
  });
}

export interface DelegateInput {
  readonly fromUserId: string;
  readonly toUserId: string;
  /** Only this document type; null for every type. */
  readonly documentType: string | null;
  /** Timestamps with an offset. */
  readonly validFrom: string;
  readonly validTo: string;
  readonly reason: string;
}

/** Hand over approval authority for a period (user.edit). 422 for a circular or overlapping delegation. */
export function useDelegate() {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: DelegateInput) =>
      (
        await api.post(
          '/approvals/delegate',
          {
            from_user_id: input.fromUserId,
            to_user_id: input.toUserId,
            document_type: input.documentType,
            valid_from: input.validFrom,
            valid_to: input.validTo,
            reason: input.reason,
          },
          { schema: DelegationSchema, idempotencyKey: idempotency.key() },
        )
      ).data,
    // The queue of the delegate changes with it.
    invalidates: () => [delegationKeys.all, approvalKeys.all],
    onSuccess: idempotency.reset,
  });
}

/** End a delegation now (user.edit): the record is kept. 409 INVALID_TRANSITION when it has already ended. */
export function useEndDelegation(delegation: Pick<Delegation, 'id'>) {
  return useApiMutation({
    mutationFn: async () =>
      (await api.post(`/approvals/delegations/${delegation.id}/end`, undefined, { schema: DelegationSchema }))
        .data,
    invalidates: () => [delegationKeys.all, approvalKeys.all],
  });
}

/** Approvals nobody can act on, re-checked by the server (workflow.view). */
export function useApprovalExceptions() {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: [...approvalKeys.all, 'exceptions'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/approvals/exceptions', { schema: z.array(ApprovalSchema), signal })).data,
  });
}

const UserOption = z.looseObject({ id: z.string(), username: z.string() });

/** Users matching what was typed, for the pickers (user.view). */
export async function findUsers(query: string, signal: AbortSignal) {
  const response = await api.get('/users', {
    query: { 'filter[username][like]': query, per_page: 20 },
    schema: z.array(UserOption),
    signal,
  });
  return response.data.map((user) => ({ id: user.id, label: user.username }));
}

const DocumentTypeOption = z.looseObject({ key: z.string(), label: z.string() });

/** The document types a delegation can be limited to (workflow.view; without it a delegation covers every type). */
export function useDocumentTypes(enabled: boolean) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: ['approval-document-types'] as const,
    enabled,
    queryFn: async ({ signal }) =>
      (await api.get('/workflows/document-types', { schema: z.array(DocumentTypeOption), signal })).data,
  });
}
