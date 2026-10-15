import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Approval workflow definitions (P1.13, P7 §3, §5, §15): the versions of each workflow with their steps, the document
 * types a workflow can govern (with the fields its conditions may test), the lifecycle (draft, submitted, active,
 * rejected, superseded) and the preview against a sample document. Amounts and quantities in a condition stay decimal
 * strings.
 */

export const workflowKeys = createQueryKeys('workflows');

export const OPERATORS = [
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'eq',
  'in',
  'not_in',
  'is_true',
  'is_false',
] as const;
export type Operator = (typeof OPERATORS)[number];

export const APPROVER_RULES = [
  'by_role',
  'by_reporting_line',
  'by_named_user',
  'by_cost_centre_manager',
] as const;
export type ApproverRule = (typeof APPROVER_RULES)[number];

export const WORKFLOW_STATES = ['draft', 'submitted', 'active', 'rejected', 'superseded'] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const MAX_STEPS = 10;
export const MAX_REPORTING_LEVEL = 5;

const ConditionSchema = z.looseObject({
  field: z.string(),
  operator: z.enum(OPERATORS),
  value: z.union([z.string(), z.array(z.string())]).nullable(),
});
export type Condition = z.infer<typeof ConditionSchema>;

const StepSchema = z.looseObject({
  id: z.string(),
  step_number: z.number().int(),
  name: z.string().nullable(),
  approver_rule: z.enum(APPROVER_RULES),
  role_id: z.string().nullable(),
  role: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
  user_id: z.string().nullable(),
  user: z.object({ id: z.string(), username: z.string() }).nullable(),
  reporting_level: z.number().int().nullable(),
  condition: ConditionSchema.nullable(),
  allow_self_approval: z.boolean(),
});
export type WorkflowStep = z.infer<typeof StepSchema>;

const WarningSchema = z.looseObject({
  code: z.string(),
  message: z.string(),
  step_number: z.number().int().nullable(),
});

export const WorkflowSchema = z.looseObject({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  document_type: z.string(),
  document_type_label: z.string(),
  estate_id: z.string().nullable(),
  department_id: z.string().nullable(),
  specificity: z.number().int(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  is_retrospective: z.boolean(),
  supersedes_id: z.string().nullable(),
  notes: z.string().nullable(),
  conditions: z.array(ConditionSchema),
  state: z.enum(WORKFLOW_STATES),
  is_active: z.boolean(),
  submitted_at: z.string().nullable(),
  submitted_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  approved_by: z.string().nullable(),
  rejected_at: z.string().nullable(),
  rejected_by: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  steps: z.array(StepSchema),
  warnings: z.array(WarningSchema).optional(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

const DocumentTypeSchema = z.looseObject({
  key: z.string(),
  label: z.string(),
  approval_class: z.string(),
  tier: z.string(),
  self_approval_configurable: z.boolean(),
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      class: z.string(),
      operators: z.array(z.enum(OPERATORS)),
    }),
  ),
  active_workflows: z.number().int(),
});
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

const PreviewSchema = z.looseObject({
  workflow_id: z.string(),
  applies: z.boolean(),
  sample: z.record(z.string(), z.string()),
  steps: z.array(
    z.object({
      step_number: z.number().int(),
      name: z.string().nullable(),
      approver_rule: z.enum(APPROVER_RULES),
      fires: z.boolean(),
      path_position: z.number().int().nullable(),
      approvers: z.array(z.object({ id: z.string(), username: z.string() })),
      approvers_deferred: z.boolean(),
      unresolved: z.boolean(),
    }),
  ),
});
export type Preview = z.infer<typeof PreviewSchema>;

export function useWorkflowsList() {
  return usePagedList({
    keys: workflowKeys,
    path: '/workflows',
    row: WorkflowSchema,
    pageSize: 25,
  });
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    ...cachePolicy('transactional'),
    queryKey: workflowKeys.detail(id ?? ''),
    enabled: id !== undefined,
    queryFn: async ({ signal }) =>
      (await api.get(`/workflows/${id ?? ''}`, { schema: WorkflowSchema, signal })).data,
  });
}

/** The approvable document types, with the fields a condition may test and how many workflows are in force. */
export function useDocumentTypeList() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: [...workflowKeys.all, 'document-types'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/workflows/document-types', { schema: z.array(DocumentTypeSchema), signal })).data,
  });
}

const Choice = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });

/** Estates and roles, for the pickers (one page of 200 each). */
export function useEstateChoices() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: [...workflowKeys.all, 'estates'] as const,
    queryFn: async ({ signal }) =>
      (await api.get('/estates', { query: { per_page: 200, sort: 'code' }, schema: z.array(Choice), signal }))
        .data,
  });
}

export function useRoleChoices() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: [...workflowKeys.all, 'roles'] as const,
    queryFn: async ({ signal }) =>
      (
        await api.get('/roles', {
          query: { per_page: 200, sort: 'sort_order' },
          schema: z.array(Choice),
          signal,
        })
      ).data,
  });
}

/** The body of a workflow, as the API takes it. */
export interface StepBody {
  readonly name: string | null;
  readonly approver_rule: ApproverRule;
  readonly role_id: string | null;
  readonly user_id: string | null;
  readonly reporting_level: number | null;
  readonly condition: { field: string; operator: Operator; value?: string | string[] | null } | null;
  readonly allow_self_approval: boolean;
}
export interface WorkflowBody {
  readonly code: string;
  readonly name: string;
  readonly document_type: string;
  readonly estate_id: string | null;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly conditions: readonly { field: string; operator: Operator; value?: string | string[] | null }[];
  readonly notes: string | null;
  readonly steps: readonly StepBody[];
}

export function useCreateWorkflow() {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (body: WorkflowBody) =>
      (await api.post('/workflows', body, { schema: WorkflowSchema, idempotencyKey: idempotency.key() }))
        .data,
    invalidates: () => [workflowKeys.all],
    onSuccess: idempotency.reset,
  });
}

/** Edit a draft (workflow.edit); the steps sent replace the whole list. */
export function useUpdateWorkflow(workflow: Pick<Workflow, 'id' | 'version' | 'name'>) {
  return useApiMutation({
    mutationFn: async (body: Partial<WorkflowBody>) =>
      (
        await api.patch(`/workflows/${workflow.id}`, body, {
          schema: WorkflowSchema,
          ifMatch: workflow.version,
        })
      ).data,
    invalidates: () => [workflowKeys.all],
    conflictSubject: () => workflow.name,
  });
}

export interface SupersedeBody {
  readonly name: string;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly conditions: WorkflowBody['conditions'];
  readonly notes: string | null;
  readonly steps: readonly StepBody[];
}

/** Start the next version of an active workflow (workflow.create). */
export function useSupersedeWorkflow(workflow: Pick<Workflow, 'id'>) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (body: SupersedeBody) =>
      (
        await api.post(`/workflows/${workflow.id}/supersede`, body, {
          schema: WorkflowSchema,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [workflowKeys.all],
    onSuccess: idempotency.reset,
  });
}

export type WorkflowAction = 'submit' | 'approve' | 'reject' | 'return';

/** Submit a draft (workflow.edit), or approve, reject or return a submitted one (workflow.approve). */
export function useWorkflowAction(workflow: Pick<Workflow, 'id'>) {
  const idempotency = useIdempotencyKey();
  const mutation = useApiMutation({
    mutationFn: async (input: { action: WorkflowAction; text: string }) => {
      const text = input.text.trim();
      const body =
        input.action === 'reject'
          ? { reason: text }
          : input.action === 'return'
            ? { comment: text }
            : input.action === 'approve'
              ? { reason: text === '' ? null : text }
              : undefined;
      return (
        await api.post(`/workflows/${workflow.id}/${input.action}`, body, {
          schema: WorkflowSchema,
          idempotencyKey: idempotency.key(),
        })
      ).data;
    },
    invalidates: () => [workflowKeys.all],
    onSuccess: idempotency.reset,
  });
  return { mutation, newAttempt: idempotency.reset };
}

/** Run a workflow against a sample document: which steps would fire and who would decide them. */
export function usePreview(id: string, sample: Readonly<Record<string, string>> | null) {
  const query = new URLSearchParams();
  for (const [field, value] of Object.entries(sample ?? {})) query.set(`sample[${field}]`, value);
  return useQuery({
    queryKey: [...workflowKeys.sub(id, 'preview', query.toString())],
    enabled: sample !== null,
    staleTime: 0,
    queryFn: async ({ signal }) =>
      (await api.get(`/workflows/${id}/preview`, { query, schema: PreviewSchema, signal })).data,
  });
}
