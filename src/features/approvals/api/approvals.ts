import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * The approval runtime (P1.14, P7 §10–§14): the signed-in user's queue across every document type, one approval with
 * its path and actions, the administrative list, and the four actions. What a user may do now is the server's
 * answer (`can`); the client never works it out from roles. Amounts stay decimal strings.
 */

export const approvalKeys = createQueryKeys('approvals');
const allApprovalKeys = createQueryKeys('approvals-all');

const UserRef = z.object({ id: z.string(), username: z.string() });
export type UserRef = z.infer<typeof UserRef>;

export const REQUEST_STATES = ['pending', 'approved', 'rejected', 'returned'] as const;
export type RequestState = (typeof REQUEST_STATES)[number];
export type ApprovalKind = 'approve' | 'reject' | 'return' | 'comment';

export const QueueItemSchema = z.looseObject({
  approval_id: z.string(),
  document_type: z.string(),
  document_type_label: z.string(),
  document_id: z.string(),
  document_number: z.string().nullable(),
  document_label: z.string(),
  amount: z.string().nullable(),
  quantity: z.string().nullable(),
  estate_id: z.string().nullable(),
  submitted_by: UserRef,
  submitted_at: z.string(),
  step_number: z.number().int(),
  step_name: z.string().nullable(),
  waiting_since: z.string(),
  waiting_hours: z.number().int(),
  acting_for: UserRef.nullable(),
  has_guard_failure: z.boolean(),
});
export type QueueItem = z.infer<typeof QueueItemSchema>;

export const STEP_STATUSES = ['done', 'current', 'upcoming', 'skipped', 'not_reached'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

const StepSchema = z.looseObject({
  step_number: z.number().int(),
  name: z.string().nullable(),
  approver_rule: z.string(),
  role: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
  user: UserRef.nullable(),
  on_path: z.boolean(),
  status: z.enum(STEP_STATUSES),
  decided_by: UserRef.nullable(),
  decided_at: z.string().nullable(),
  approvers: z.array(UserRef),
});
export type ApprovalStep = z.infer<typeof StepSchema>;

const ActionSchema = z.looseObject({
  id: z.string(),
  action: z.enum(['approve', 'reject', 'return', 'comment']),
  step_number: z.number().int().nullable(),
  user: UserRef,
  acting_for: UserRef.nullable(),
  comment: z.string().nullable(),
  acted_at: z.string(),
  is_self_approval: z.boolean(),
  bulk_reference: z.string().nullable(),
});
export type ApprovalAction = z.infer<typeof ActionSchema>;

export const ApprovalSchema = z.looseObject({
  id: z.string(),
  document_type: z.string(),
  document_type_label: z.string(),
  document_id: z.string(),
  document_number: z.string().nullable(),
  document_label: z.string(),
  amount: z.string().nullable(),
  quantity: z.string().nullable(),
  estate_id: z.string().nullable(),
  workflow_id: z.string(),
  workflow_code: z.string(),
  state: z.enum(REQUEST_STATES),
  current_step_number: z.number().int().nullable(),
  is_unresolved: z.boolean(),
  is_exceptional: z.boolean(),
  guard_failure: z
    .object({ code: z.string(), message: z.string(), at: z.string(), by: z.string() })
    .nullable(),
  submitted_by: UserRef,
  submitted_at: z.string(),
  completed_at: z.string().nullable(),
  version: z.number().int(),
  steps: z.array(StepSchema),
  actions: z.array(ActionSchema),
  can: z.object({ approve: z.boolean(), reject: z.boolean(), return: z.boolean(), comment: z.boolean() }),
});
export type Approval = z.infer<typeof ApprovalSchema>;

/** The user's queue: what awaits them, oldest first. Refreshed often; it is what they act on. */
export function useApprovalQueue() {
  return usePagedList({
    keys: approvalKeys,
    path: '/approvals/pending',
    row: QueueItemSchema,
    policy: 'live',
  });
}

/** Every approval in the user's scope (workflow.view), oldest submission first. */
export function useAllApprovals() {
  return usePagedList({
    keys: allApprovalKeys,
    path: '/approvals',
    row: ApprovalSchema,
    policy: 'live',
  });
}

/** How many approvals await the user: for the top bar. */
export function useApprovalsWaiting() {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: [...approvalKeys.all, 'count'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/approvals/pending/count', { schema: z.object({ count: z.number().int() }), signal }))
        .data.count,
  });
}

export function useApproval(id: string | undefined) {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: approvalKeys.detail(id ?? ''),
    enabled: id !== undefined,
    queryFn: async ({ signal }) =>
      (await api.get(`/approvals/${id ?? ''}`, { schema: ApprovalSchema, signal })).data,
  });
}

export interface ActionInput {
  readonly kind: ApprovalKind;
  /** The step as the user saw it: someone else deciding it first is a 409 APPROVAL_STEP_CHANGED. */
  readonly stepNumber: number;
  readonly text: string;
}

/**
 * Approve, reject, return or comment (P7 §10). A reject needs a reason and a return a comment; they go under the
 * names the API gives them. The answer is the approval as it now stands; the queue, the count and the other
 * approval lists are refreshed.
 */
export function useApprovalAction(id: string) {
  const idempotency = useIdempotencyKey();
  const mutation = useApiMutation({
    mutationFn: async ({ kind, stepNumber, text }: ActionInput) => {
      const comment = text.trim();
      const body =
        kind === 'comment'
          ? { comment }
          : kind === 'reject'
            ? { step_number: stepNumber, reason: comment }
            : { step_number: stepNumber, ...(comment === '' ? {} : { comment }) };
      return (
        await api.post(`/approvals/${id}/${kind}`, body, {
          schema: ApprovalSchema,
          idempotencyKey: idempotency.key(),
        })
      ).data;
    },
    invalidates: () => [approvalKeys.all, allApprovalKeys.all],
    onSuccess: idempotency.reset,
  });
  // A retry of the same action keeps its key; a different action (another dialog) starts afresh.
  return { mutation, newAttempt: idempotency.reset };
}
