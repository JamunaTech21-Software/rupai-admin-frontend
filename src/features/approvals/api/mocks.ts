import { http, type RequestHandler } from 'msw';

import { apiError, ok, page, requireAuth } from '@/lib/mocking/contract';

import { type Approval, type ApprovalKind, type QueueItem } from './approvals';
import { type Delegation } from './delegations';

/**
 * In-memory approvals (P1.14) for VITE_MOCK_API=approvals and for tests, with the backend's rules: a decision names
 * the step it is for and is refused when another decided it first (409 APPROVAL_STEP_CHANGED); a rejection needs a
 * reason and a return a comment (422); the last approval hands over to the document, which may refuse it (422 with
 * its own code) while the approval is still recorded. The queue holds what the manager may decide.
 */

const NOW = '2026-10-15T04:00:00.000Z';
const ME = { id: 'usr_manager', username: 'manager' };
const RAHIM = { id: 'usr_rahim', username: 'rahim' };
const SHEFALI = { id: 'usr_shefali', username: 'shefali' };

interface Entry {
  approval: Approval;
  /** In the manager's queue. */
  mine: boolean;
  actingFor: typeof RAHIM | null;
  waitingHours: number;
  /** The document refuses its final approval (the last-step approve answers 422). */
  refuses?: boolean;
}

function step(
  number: number,
  name: string,
  status: Approval['steps'][number]['status'],
  approvers: readonly (typeof ME)[] = [],
): Approval['steps'][number] {
  return {
    step_number: number,
    name,
    approver_rule: 'role',
    role: { id: 'role_1', code: 'MANAGER', name: 'Estate manager' },
    user: null,
    on_path: true,
    status,
    decided_by: status === 'done' ? SHEFALI : null,
    decided_at: status === 'done' ? NOW : null,
    approvers: [...approvers],
  };
}

const CAN_ALL = { approve: true, reject: true, return: true, comment: true } as const;
const CAN_NONE = { approve: false, reject: false, return: false, comment: false } as const;

function approval(
  fields: Partial<Approval> & Pick<Approval, 'id' | 'document_type_label' | 'document_label'>,
) {
  return {
    document_type: 'purchase_order',
    document_id: `d_${fields.id}`,
    document_number: null,
    amount: null,
    quantity: null,
    estate_id: '1',
    workflow_id: 'wf_1',
    workflow_code: 'PO-STANDARD',
    state: 'pending',
    current_step_number: 1,
    is_unresolved: false,
    is_exceptional: false,
    guard_failure: null,
    submitted_by: SHEFALI,
    submitted_at: '2026-10-13T00:00:00.000Z',
    completed_at: null,
    version: 1,
    steps: [step(1, 'Estate manager', 'current', [ME])],
    actions: [],
    can: CAN_ALL,
    ...fields,
  } satisfies Approval;
}

const seed = (): Entry[] => [
  {
    mine: true,
    actingFor: null,
    waitingHours: 52,
    approval: approval({
      id: 'a_po',
      document_number: 'PO-2026-0007',
      document_type_label: 'Purchase order',
      document_label: 'Fertiliser for Field 4',
      amount: '125000.00',
      steps: [step(1, 'Estate manager', 'current', [ME]), step(2, 'Finance', 'upcoming')],
    }),
  },
  {
    mine: true,
    actingFor: RAHIM,
    waitingHours: 5,
    approval: approval({
      id: 'a_pay',
      document_type: 'payment',
      document_number: 'PAY-2026-0031',
      document_type_label: 'Payment',
      document_label: 'Supplier payment',
      amount: '48250.50',
      current_step_number: 2,
      steps: [step(1, 'Estate manager', 'done'), step(2, 'Finance', 'current', [ME])],
      actions: [
        {
          id: 'act_1',
          action: 'approve',
          step_number: 1,
          user: SHEFALI,
          acting_for: null,
          comment: 'Checked against the invoice.',
          acted_at: '2026-10-14T10:00:00.000Z',
          is_self_approval: false,
          bulk_reference: null,
        },
      ],
    }),
  },
  {
    mine: true,
    actingFor: null,
    waitingHours: 80,
    refuses: true,
    approval: approval({
      id: 'a_lease',
      document_type: 'lease',
      document_number: 'LS-2026-0002',
      document_type_label: 'Lease agreement',
      document_label: 'Lease of Block C',
      guard_failure: {
        code: 'LEASE_INCOMPLETE',
        message: 'The lease has no end date.',
        at: '2026-10-14T09:00:00.000Z',
        by: 'manager',
      },
    }),
  },
  {
    mine: false,
    actingFor: null,
    waitingHours: 120,
    approval: approval({
      id: 'a_leave',
      document_type: 'leave',
      document_type_label: 'Leave',
      document_label: 'Annual leave, 5 days',
      is_unresolved: true,
      steps: [step(1, 'Estate manager', 'current')],
      can: CAN_NONE,
    }),
  },
  {
    mine: false,
    actingFor: null,
    waitingHours: 0,
    approval: approval({
      id: 'a_sale',
      document_type: 'sale',
      document_number: 'SL-2026-0100',
      document_type_label: 'Sale',
      document_label: 'Auction lot 12',
      amount: '980000.00',
      state: 'approved',
      current_step_number: null,
      completed_at: '2026-10-12T00:00:00.000Z',
      steps: [step(1, 'Estate manager', 'done')],
      can: CAN_NONE,
    }),
  },
];

const USERS = [ME, RAHIM, SHEFALI];

const seedDelegations = (): Delegation[] => [
  {
    id: 'del_1',
    from_user: RAHIM,
    to_user: ME,
    document_type: null,
    valid_from: '2026-10-10T00:00:00+06:00',
    valid_to: '2026-10-31T23:59:59+06:00',
    ended_at: null,
    is_active: true,
    reason: 'On leave until the end of the month.',
    created_by: 'manager',
    created_at: '2026-10-09T10:00:00.000Z',
  },
  {
    id: 'del_2',
    from_user: SHEFALI,
    to_user: RAHIM,
    document_type: 'payment',
    valid_from: '2026-09-01T00:00:00+06:00',
    valid_to: '2026-09-15T23:59:59+06:00',
    ended_at: null,
    is_active: false,
    reason: 'Training course.',
    created_by: 'manager',
    created_at: '2026-08-30T10:00:00.000Z',
  },
];

let entries: Entry[] = seed();
let delegations: Delegation[] = seedDelegations();

export function resetApprovalMocks(): void {
  entries = seed();
  delegations = seedDelegations();
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The approval does not exist.');
const find = (id: string | readonly string[] | undefined) => entries.find((e) => e.approval.id === id);

function queueItem(entry: Entry): QueueItem {
  const a = entry.approval;
  return {
    approval_id: a.id,
    document_type: a.document_type,
    document_type_label: a.document_type_label,
    document_id: a.document_id,
    document_number: a.document_number,
    document_label: a.document_label,
    amount: a.amount,
    quantity: a.quantity,
    estate_id: a.estate_id,
    submitted_by: a.submitted_by,
    submitted_at: a.submitted_at,
    step_number: a.current_step_number ?? 1,
    step_name: a.steps.find((s) => s.step_number === a.current_step_number)?.name ?? null,
    waiting_since: NOW,
    waiting_hours: entry.waitingHours,
    acting_for: entry.actingFor,
    has_guard_failure: a.guard_failure !== null,
  };
}

const REASON = 'Say why: a reason is required.';

export function approvalMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.get(`${base}/approvals/pending/count`, ({ request }) => {
      return requireAuth(request) ?? ok({ count: entries.filter((e) => e.mine).length });
    }),

    http.get(`${base}/approvals/pending`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const from = Number.parseInt(
        new URL(request.url).searchParams.get('filter[waiting_hours_from]') ?? '0',
        10,
      );
      const rows = entries
        .filter((e) => e.mine && e.waitingHours >= from)
        .sort((a, b) => b.waitingHours - a.waitingHours)
        .map(queueItem);
      return page(request, rows);
    }),

    http.get(`${base}/approvals`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const state = params.get('filter[state]');
      const unresolved = params.get('filter[is_unresolved]') === 'true';
      const rows = entries
        .map((e) => e.approval)
        .filter((a) => (state === null || a.state === state) && (!unresolved || a.is_unresolved));
      return page(request, rows);
    }),

    http.get(`${base}/approvals/exceptions`, ({ request }) => {
      return requireAuth(request) ?? ok(entries.map((e) => e.approval).filter((a) => a.is_unresolved));
    }),

    http.get(`${base}/approvals/delegations`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const active = new URL(request.url).searchParams.get('filter[is_active]') === 'true';
      return page(
        request,
        delegations.filter((d) => !active || d.is_active),
      );
    }),

    http.post(`${base}/approvals/delegate`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as {
        from_user_id: string;
        to_user_id: string;
        document_type: string | null;
        valid_from: string;
        valid_to: string;
        reason: string;
      };
      if (body.from_user_id === body.to_user_id)
        return apiError(422, 'VALIDATION_FAILED', 'A user cannot delegate to themselves.', [
          {
            field: 'to_user_id',
            code: 'VALIDATION_FAILED',
            message: 'A user cannot delegate to themselves.',
          },
        ]);
      if (Date.parse(body.valid_to) - Date.parse(body.valid_from) > 90 * 86_400_000)
        return apiError(422, 'VALIDATION_FAILED', 'A delegation lasts at most 90 days.', [
          { field: 'valid_to', code: 'VALIDATION_FAILED', message: 'A delegation lasts at most 90 days.' },
        ]);
      const user = (id: string) => USERS.find((u) => u.id === id) ?? ME;
      const made: Delegation = {
        id: `del_${String(delegations.length + 1)}`,
        from_user: user(body.from_user_id),
        to_user: user(body.to_user_id),
        document_type: body.document_type,
        valid_from: body.valid_from,
        valid_to: body.valid_to,
        ended_at: null,
        is_active: true,
        reason: body.reason,
        created_by: 'manager',
        created_at: NOW,
      };
      delegations.unshift(made);
      return ok(made, { status: 201 });
    }),

    http.post(`${base}/approvals/delegations/:id/end`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = delegations.find((d) => d.id === params.id);
      if (!found) return notFound();
      if (found.ended_at) return apiError(409, 'INVALID_TRANSITION', 'The delegation has already ended.');
      found.ended_at = NOW;
      found.is_active = false;
      return ok(found);
    }),

    http.get(`${base}/users`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const like = (new URL(request.url).searchParams.get('filter[username][like]') ?? '').toLowerCase();
      return page(
        request,
        USERS.filter((u) => u.username.includes(like)),
      );
    }),

    http.get(`${base}/approvals/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const entry = find(params.id);
      return entry ? ok(entry.approval, { version: entry.approval.version }) : notFound();
    }),

    ...(['approve', 'reject', 'return', 'comment'] as const satisfies readonly ApprovalKind[]).map((kind) =>
      http.post(`${base}/approvals/:id/${kind}`, async ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const entry = find(params.id);
        if (!entry) return notFound();
        const a = entry.approval;
        const body = (await request.json()) as { step_number?: number; comment?: string; reason?: string };

        if (!a.can[kind])
          return apiError(403, 'NOT_AN_APPROVER', 'You are not an approver of the current step.');
        const text = (kind === 'reject' ? body.reason : body.comment)?.trim() ?? '';
        if (kind !== 'approve' && text === '')
          return apiError(422, 'VALIDATION_FAILED', REASON, [
            { field: kind === 'reject' ? 'reason' : 'comment', code: 'REQUIRED', message: REASON },
          ]);
        if (kind !== 'comment' && body.step_number !== a.current_step_number)
          return apiError(409, 'APPROVAL_STEP_CHANGED', 'Someone else decided this step first.');

        a.actions.push({
          id: `act_${String(a.actions.length + 1)}`,
          action: kind,
          step_number: kind === 'comment' ? null : (body.step_number ?? null),
          user: ME,
          acting_for: entry.actingFor,
          comment: text === '' ? null : text,
          acted_at: NOW,
          is_self_approval: false,
          bulk_reference: null,
        });
        a.version += 1;

        if (kind === 'reject' || kind === 'return') {
          a.state = kind === 'reject' ? 'rejected' : 'returned';
          a.current_step_number = null;
          a.completed_at = NOW;
          a.can = CAN_NONE;
          entry.mine = false;
        }
        if (kind === 'approve') {
          const current = a.steps.find((s) => s.step_number === a.current_step_number);
          const next = a.steps.find((s) => s.step_number === (a.current_step_number ?? 0) + 1);
          // The approval is recorded either way; the document's refusal leaves the step where it was.
          if (!next && entry.refuses) return apiError(422, 'LEASE_INCOMPLETE', 'The lease has no end date.');
          if (current) {
            current.status = 'done';
            current.decided_by = ME;
            current.decided_at = NOW;
          }
          if (next) {
            next.status = 'current';
            a.current_step_number = next.step_number;
            a.can = { ...CAN_NONE, comment: true };
            entry.mine = false;
          } else {
            a.state = 'approved';
            a.current_step_number = null;
            a.completed_at = NOW;
            a.can = CAN_NONE;
            entry.mine = false;
          }
        }
        return ok(a, { version: a.version });
      }),
    ),
  ];
}

export const handlers: RequestHandler[] = approvalMocks();
