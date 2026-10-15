import { http, type RequestHandler } from 'msw';

import { apiError, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';
import { Dec } from '@/lib/money';

import { type Workflow } from './workflows';

/**
 * In-memory approval workflows (P1.13) for VITE_MOCK_API=workflows and for tests, with the backend's rules: only a
 * draft is edited (409 INVALID_TRANSITION) and only with the version it was read at; only an active workflow gets a
 * next version; the creator cannot approve their own version (403 SELF_APPROVAL_FORBIDDEN); a version taking
 * effect in the past needs a reason; a code already in use is refused (422 DUPLICATE_KEY); a definition the server
 * rejects names the field it concerns.
 */

const TODAY = '2026-10-15';
const NOW = '2026-10-14T04:00:00.000Z';
const ME = 'usr_manager';
const OTHER = 'usr_other';

const TYPES = [
  {
    key: 'purchase_order',
    label: 'Purchase order',
    approval_class: 'financial',
    tier: 'estate',
    self_approval_configurable: true,
    active_workflows: 1,
    fields: [
      {
        name: 'total_base_amount',
        label: 'Total amount',
        class: 'amount',
        operators: ['lt', 'lte', 'gt', 'gte', 'between'],
      },
      { name: 'estate_id', label: 'Estate', class: 'organisational', operators: ['eq', 'in', 'not_in'] },
      { name: 'is_urgent', label: 'Urgent', class: 'flag', operators: ['is_true', 'is_false'] },
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    approval_class: 'financial',
    tier: 'estate',
    self_approval_configurable: false,
    active_workflows: 0,
    fields: [
      { name: 'amount', label: 'Amount', class: 'amount', operators: ['lt', 'lte', 'gt', 'gte', 'between'] },
    ],
  },
  {
    key: 'leave',
    label: 'Leave',
    approval_class: 'leave',
    tier: 'estate',
    self_approval_configurable: false,
    active_workflows: 0,
    fields: [],
  },
];

const ROLES = [
  { id: '1', code: 'MANAGER', name: 'Estate manager' },
  { id: '2', code: 'ACCOUNTANT', name: 'Accountant' },
];

const ESTATES = [{ id: '1', code: 'E1', name: 'Demo Estate' }];

function step(number: number, fields: Partial<Workflow['steps'][number]> = {}): Workflow['steps'][number] {
  return {
    id: `st_${String(number)}`,
    step_number: number,
    name: null,
    approver_rule: 'by_role',
    role_id: '1',
    role: { id: '1', code: 'MANAGER', name: 'Estate manager' },
    user_id: null,
    user: null,
    reporting_level: null,
    condition: null,
    allow_self_approval: false,
    ...fields,
  };
}

function workflow(fields: Partial<Workflow> & Pick<Workflow, 'id' | 'code' | 'name' | 'state'>): Workflow {
  return {
    document_type: 'purchase_order',
    document_type_label: 'Purchase order',
    estate_id: null,
    department_id: null,
    specificity: 0,
    effective_from: '2026-07-01',
    effective_to: null,
    is_retrospective: false,
    supersedes_id: null,
    notes: null,
    conditions: [],
    is_active: fields.state === 'active',
    submitted_at: null,
    submitted_by: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    version: 1,
    created_at: NOW,
    created_by: OTHER,
    updated_at: null,
    steps: [step(1)],
    ...fields,
  };
}

const seed = (): Workflow[] => [
  workflow({
    id: 'wf_1',
    code: 'PO-LADDER',
    name: 'Purchase order ladder',
    state: 'active',
    approved_at: NOW,
    approved_by: OTHER,
    steps: [
      step(1, { name: 'Estate manager' }),
      step(2, {
        name: 'Finance review',
        role_id: '2',
        role: { id: '2', code: 'ACCOUNTANT', name: 'Accountant' },
        condition: { field: 'total_base_amount', operator: 'gte', value: '100000.00' },
      }),
    ],
    warnings: [{ code: 'ROLE_HAS_NO_HOLDER', message: 'Nobody holds the role Accountant.', step_number: 2 }],
  }),
  workflow({
    id: 'wf_2',
    code: 'PO-DRAFT',
    name: 'Purchase order, new rules',
    state: 'draft',
    conditions: [{ field: 'is_urgent', operator: 'is_true', value: null }],
    steps: [step(1, { name: 'Manager' })],
  }),
  workflow({
    id: 'wf_3',
    code: 'PAY-BASIC',
    name: 'Payment approval',
    state: 'submitted',
    document_type: 'payment',
    document_type_label: 'Payment',
    submitted_at: NOW,
    submitted_by: OTHER,
    created_by: OTHER,
  }),
  workflow({
    id: 'wf_4',
    code: 'LEAVE-OWN',
    name: 'Leave approval (mine)',
    state: 'submitted',
    document_type: 'leave',
    document_type_label: 'Leave',
    submitted_at: NOW,
    submitted_by: ME,
    created_by: ME,
  }),
  workflow({
    id: 'wf_5',
    code: 'PAY-OLD',
    name: 'Payment approval, old',
    state: 'rejected',
    document_type: 'payment',
    document_type_label: 'Payment',
    rejected_at: NOW,
    rejected_by: OTHER,
    rejection_reason: 'The limit is too high.',
  }),
];

let workflows: Workflow[] = seed();
let sequence = 10;

export function resetWorkflowMocks(): void {
  workflows = seed();
  sequence = 10;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The workflow does not exist.');
const find = (id: string | readonly string[] | undefined) => workflows.find((w) => w.id === id);
const transition = () =>
  apiError(409, 'INVALID_TRANSITION', 'That is not possible in the workflow’s current state.');

interface StepIn {
  name?: string | null;
  approver_rule: Workflow['steps'][number]['approver_rule'];
  role_id?: string | null;
  user_id?: string | null;
  reporting_level?: number | null;
  condition?: Workflow['steps'][number]['condition'];
  allow_self_approval?: boolean;
}

const stepsOf = (input: readonly StepIn[]): Workflow['steps'] =>
  input.map((s, index) =>
    step(index + 1, {
      name: s.name ?? null,
      approver_rule: s.approver_rule,
      role_id: s.role_id ?? null,
      role: ROLES.find((role) => role.id === s.role_id) ?? null,
      user_id: s.user_id ?? null,
      user: s.user_id ? { id: s.user_id, username: 'rahim' } : null,
      reporting_level: s.reporting_level ?? null,
      condition: s.condition ?? null,
      allow_self_approval: s.allow_self_approval ?? false,
    }),
  );

/** Conditions as the server answers them: a flag has a null value. */
const conditionsOf = (
  input: readonly {
    field: string;
    operator: Workflow['conditions'][number]['operator'];
    value?: Workflow['conditions'][number]['value'] | undefined;
  }[],
): Workflow['conditions'] =>
  input.map((c) => ({ field: c.field, operator: c.operator, value: c.value ?? null }));

/** The server's refusal of a definition: a condition on a step that has no value. */
function invalid(input: readonly StepIn[]) {
  const at = input.findIndex(
    (s) => s.condition && !['is_true', 'is_false'].includes(s.condition.operator) && !s.condition.value,
  );
  if (at < 0) return null;
  const message = 'The condition needs a value.';
  return apiError(422, 'VALIDATION_FAILED', 'The workflow is not valid.', [
    { field: `steps.${String(at)}.condition`, code: 'WORKFLOW_CONDITION_INVALID', message },
  ]);
}

export function workflowMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.get(`${base}/workflows/document-types`, ({ request }) => {
      return requireAuth(request) ?? ok(TYPES);
    }),

    http.get(`${base}/estates`, ({ request }) => requireAuth(request) ?? page(request, ESTATES)),
    http.get(`${base}/roles`, ({ request }) => requireAuth(request) ?? page(request, ROLES)),

    http.get(`${base}/workflows`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const state = params.get('filter[state]');
      const type = params.get('filter[document_type]');
      const asOf = params.get('filter[as_of]');
      return page(
        request,
        workflows.filter(
          (w) =>
            (state === null || w.state === state) &&
            (type === null || w.document_type === type) &&
            (asOf === null ||
              (w.state === 'active' && w.effective_from <= asOf && (w.effective_to ?? '9999') >= asOf)),
        ),
      );
    }),

    http.post(`${base}/workflows`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as {
        code: string;
        name: string;
        document_type: string;
        estate_id: string | null;
        effective_from: string;
        effective_to: string | null;
        conditions: Workflow['conditions'];
        notes: string | null;
        steps: StepIn[];
      };
      if (workflows.some((w) => w.code === body.code))
        return apiError(422, 'DUPLICATE_KEY', 'That code is already in use.', [
          { field: 'code', code: 'DUPLICATE_KEY', message: 'That code is already in use.' },
        ]);
      const bad = invalid(body.steps);
      if (bad) return bad;
      sequence += 1;
      const made = workflow({
        id: `wf_${String(sequence)}`,
        code: body.code,
        name: body.name,
        state: 'draft',
        document_type: body.document_type,
        document_type_label: TYPES.find((t) => t.key === body.document_type)?.label ?? body.document_type,
        estate_id: body.estate_id,
        effective_from: body.effective_from,
        effective_to: body.effective_to,
        is_retrospective: body.effective_from < TODAY,
        conditions: conditionsOf(body.conditions),
        notes: body.notes,
        created_by: ME,
        steps: stepsOf(body.steps),
      });
      workflows.unshift(made);
      return ok(made, { status: 201, version: made.version });
    }),

    http.get(`${base}/workflows/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      return found ? ok(found, { version: found.version }) : notFound();
    }),

    http.patch(`${base}/workflows/:id`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (!found) return notFound();
      if (found.state !== 'draft') return transition();
      const stale = requireIfMatch(request, found.version);
      if (stale) return stale;
      const body = (await request.json()) as Partial<Workflow> & { steps?: StepIn[] };
      if (body.steps) {
        const bad = invalid(body.steps);
        if (bad) return bad;
        found.steps = stepsOf(body.steps);
      }
      const { steps: _steps, conditions, ...rest } = body;
      Object.assign(found, rest);
      if (conditions) found.conditions = conditionsOf(conditions);
      found.version += 1;
      return ok(found, { version: found.version });
    }),

    http.post(`${base}/workflows/:id/supersede`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (!found) return notFound();
      if (found.state !== 'active') return transition();
      const body = (await request.json()) as {
        name?: string;
        effective_from: string;
        effective_to: string | null;
        conditions?: Workflow['conditions'];
        notes?: string | null;
        steps?: StepIn[];
      };
      sequence += 1;
      const made = workflow({
        ...found,
        id: `wf_${String(sequence)}`,
        name: body.name ?? found.name,
        state: 'draft',
        is_active: false,
        supersedes_id: found.id,
        effective_from: body.effective_from,
        effective_to: body.effective_to,
        conditions: body.conditions ? conditionsOf(body.conditions) : found.conditions,
        notes: body.notes ?? found.notes,
        steps: body.steps ? stepsOf(body.steps) : found.steps,
        created_by: ME,
        approved_at: null,
        approved_by: null,
        version: 1,
      });
      workflows.unshift(made);
      return ok(made, { status: 201, version: made.version });
    }),

    http.post(`${base}/workflows/:id/submit`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (!found) return notFound();
      if (found.state !== 'draft') return transition();
      found.state = 'submitted';
      found.submitted_at = NOW;
      found.submitted_by = ME;
      found.version += 1;
      return ok(found, { version: found.version });
    }),

    ...(['approve', 'reject', 'return'] as const).map((action) =>
      http.post(`${base}/workflows/:id/${action}`, async ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const found = find(params.id);
        if (!found) return notFound();
        if (found.state !== 'submitted')
          return apiError(409, 'NOT_SUBMITTED', 'The workflow is not submitted.');
        const body = (await request.json()) as { reason?: string | null; comment?: string };
        if (action === 'approve') {
          if (found.created_by === ME)
            return apiError(403, 'SELF_APPROVAL_FORBIDDEN', 'You cannot approve a version you created.');
          if (found.is_retrospective && !body.reason)
            return apiError(
              422,
              'RETROSPECTIVE_APPROVAL_REQUIRED',
              'A reason is needed: it takes effect in the past.',
            );
          found.state = 'active';
          found.is_active = true;
          found.approved_at = NOW;
          found.approved_by = ME;
        } else if (action === 'reject') {
          found.state = 'rejected';
          found.rejected_at = NOW;
          found.rejected_by = ME;
          found.rejection_reason = body.reason ?? null;
        } else {
          found.state = 'draft';
          found.submitted_at = null;
        }
        found.version += 1;
        return ok(found, { version: found.version });
      }),
    ),

    http.get(`${base}/workflows/:id/preview`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (!found) return notFound();
      const sample: Record<string, string> = {};
      for (const [key, value] of new URL(request.url).searchParams) {
        const match = /^sample\[(.+)\]$/.exec(key);
        if (match?.[1]) sample[match[1]] = value;
      }
      let position = 0;
      return ok({
        workflow_id: found.id,
        applies: true,
        sample,
        steps: found.steps.map((s) => {
          const amount = sample.total_base_amount;
          const fires =
            !s.condition ||
            (s.condition.operator === 'gte' &&
              amount !== undefined &&
              new Dec(amount).gte(String(s.condition.value)));
          if (fires) position += 1;
          const nobody = s.role?.code === 'ACCOUNTANT';
          return {
            step_number: s.step_number,
            name: s.name,
            approver_rule: s.approver_rule,
            fires,
            path_position: fires ? position : null,
            approvers:
              fires && !nobody && s.approver_rule === 'by_role' ? [{ id: ME, username: 'manager' }] : [],
            approvers_deferred: s.approver_rule === 'by_reporting_line',
            unresolved: fires && nobody,
          };
        }),
      });
    }),
  ];
}

export const handlers: RequestHandler[] = workflowMocks();
