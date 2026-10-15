import { http, type RequestHandler } from 'msw';

import { apiError, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import { type AppNotification, type Rule } from './notifications';

/**
 * In-memory notifications and notification rules (P1.16) for VITE_MOCK_API=notifications and for tests, with the
 * backend's rules: dismissed notifications are left out unless asked for; dismissing also marks read; the summary
 * counts the unread ones that are not dismissed; "read all" marks only up to the id given; someone else's id is 404;
 * a rule is changed only with the version read, and a code already in use is refused.
 */

const NOW = '2026-10-15T04:00:00.000Z';

function note(fields: Partial<AppNotification> & Pick<AppNotification, 'id' | 'subject'>): AppNotification {
  return {
    body: 'Details of the notification.',
    severity: 'info',
    link: { type: 'approval', id: '12', route: '/approvals/12' },
    rule: { code: 'APPROVAL_PENDING', name: 'Approval pending', trigger_type: 'approval_pending' },
    occurred_on: '2026-10-15',
    created_at: NOW,
    is_read: false,
    read_at: null,
    dismissed_at: null,
    email: { state: 'not_required', delivered_at: null, error: null },
    ...fields,
  };
}

const seed = (): AppNotification[] => [
  note({
    id: '5',
    subject: 'Approval needed: PO-2026-0007',
    body: 'A purchase order is waiting for your decision.',
    created_at: '2026-10-15T04:00:00.000Z',
  }),
  note({
    id: '4',
    subject: 'Licence expires in 10 days',
    body: 'The factory licence expires on 25 Oct 2026.',
    severity: 'critical',
    link: { type: 'document', id: '7', route: '/documents/expiring' },
    rule: { code: 'DOC_EXPIRY', name: 'Document expiring', trigger_type: 'document_expiry' },
    created_at: '2026-10-15T03:00:00.000Z',
  }),
  note({
    id: '3',
    subject: 'Access review found 2 conflicts',
    body: 'Two users hold conflicting permissions.',
    severity: 'warning',
    link: { type: 'access_review', id: '1', route: '/admin/access-review' },
    rule: { code: 'ACCESS_REVIEW', name: 'Access review findings', trigger_type: 'access_review' },
    created_at: '2026-10-14T09:00:00.000Z',
    is_read: true,
    read_at: '2026-10-14T10:00:00.000Z',
  }),
  note({
    id: '2',
    subject: 'Approval needed: PAY-2026-0031',
    created_at: '2026-10-13T09:00:00.000Z',
    is_read: true,
    read_at: '2026-10-13T10:00:00.000Z',
    dismissed_at: '2026-10-13T10:00:00.000Z',
  }),
];

const TRIGGERS = [
  {
    key: 'approval_pending',
    label: 'Approval pending',
    description: 'A document reached an approval step: its approvers are told.',
    recipient_rules: ['approvers'],
    uses_lead_days: false,
    evaluated: true,
    arrives_with: null,
  },
  {
    key: 'document_expiry',
    label: 'Document expiring',
    description: 'A licence, certificate or agreement on file expires within the days ahead.',
    recipient_rules: ['by_role', 'by_scope', 'by_named_user'],
    uses_lead_days: true,
    evaluated: true,
    arrives_with: null,
  },
  {
    key: 'low_stock',
    label: 'Low stock',
    description: 'An item’s stock fell to or below its reorder level.',
    recipient_rules: ['by_role', 'by_scope', 'by_named_user'],
    uses_lead_days: false,
    evaluated: false,
    arrives_with: 'Inventory',
  },
] as const;

const triggerOf = (key: string): Rule['trigger'] =>
  (TRIGGERS.find((candidate) => candidate.key === key) ?? TRIGGERS[0]) as unknown as Rule['trigger'];

function rule(fields: Partial<Rule> & Pick<Rule, 'id' | 'code' | 'name' | 'trigger_type'>): Rule {
  return {
    description: null,
    trigger: triggerOf(fields.trigger_type),
    condition: null,
    lead_days: null,
    recipient_rule: 'approvers',
    role: null,
    user: null,
    channel: 'in_app',
    severity: 'info',
    is_active: true,
    version: 1,
    created_at: NOW,
    updated_at: null,
    ...fields,
  };
}

const seedRules = (): Rule[] => [
  rule({ id: 'r1', code: 'APPROVAL_PENDING', name: 'Approval pending', trigger_type: 'approval_pending' }),
  rule({
    id: 'r2',
    code: 'DOC_EXPIRY',
    name: 'Document expiring',
    trigger_type: 'document_expiry',
    lead_days: 30,
    recipient_rule: 'by_role',
    role: { id: '1', code: 'ADMINISTRATOR', name: 'System Administrator' },
    channel: 'email',
    severity: 'warning',
    condition: { document_type_codes: ['LICENCE'] },
  }),
  rule({
    id: 'r3',
    code: 'LOW_STOCK',
    name: 'Low stock',
    trigger_type: 'low_stock',
    recipient_rule: 'by_role',
    role: { id: '1', code: 'ADMINISTRATOR', name: 'System Administrator' },
    is_active: false,
  }),
];

let notifications: AppNotification[] = seed();
let rules: Rule[] = seedRules();
let sequence = 10;

export function resetNotificationMocks(): void {
  notifications = seed();
  rules = seedRules();
  sequence = 10;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The notification does not exist.');
const find = (id: string | readonly string[] | undefined) => notifications.find((n) => n.id === id);
const live = () => notifications.filter((n) => n.dismissed_at === null && !n.is_read);

export function notificationMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.get(`${base}/notifications/summary`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const unread = live();
      return ok({
        unread: unread.length,
        unread_critical: unread.filter((n) => n.severity === 'critical').length,
        latest_at: notifications[0]?.created_at ?? null,
      });
    }),

    http.post(`${base}/notifications/read-all`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json().catch(() => ({}))) as { up_to_id?: string };
      const limit =
        body.up_to_id === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(body.up_to_id, 10);
      let marked = 0;
      for (const n of live()) {
        if (Number.parseInt(n.id, 10) <= limit) {
          n.is_read = true;
          n.read_at = NOW;
          marked += 1;
        }
      }
      return ok({ marked_read: marked });
    }),

    http.get(`${base}/notifications`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const dismissed = params.get('filter[is_dismissed]') === 'true';
      const read = params.get('filter[is_read]');
      const severity = params.get('filter[severity]');
      return page(
        request,
        notifications.filter(
          (n) =>
            (dismissed ? n.dismissed_at !== null : n.dismissed_at === null) &&
            (read === null || String(n.is_read) === read) &&
            (severity === null || n.severity === severity),
        ),
      );
    }),

    ...(['read', 'unread', 'dismiss', 'restore'] as const).map((action) =>
      http.post(`${base}/notifications/:id/${action}`, ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const found = find(params.id);
        if (!found) return notFound();
        if (action === 'read' || action === 'dismiss') {
          found.is_read = true;
          found.read_at = found.read_at ?? NOW;
        }
        if (action === 'unread') {
          found.is_read = false;
          found.read_at = null;
        }
        if (action === 'dismiss') found.dismissed_at = NOW;
        if (action === 'restore') found.dismissed_at = null;
        return ok(found);
      }),
    ),

    http.get(
      `${base}/roles`,
      ({ request }) =>
        requireAuth(request) ??
        page(request, [{ id: '1', code: 'ADMINISTRATOR', name: 'System Administrator' }]),
    ),

    http.get(`${base}/notification-rules/triggers`, ({ request }) => {
      return requireAuth(request) ?? ok(TRIGGERS);
    }),

    http.get(`${base}/notification-rules`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const trigger = params.get('filter[trigger_type]');
      const active = params.get('filter[is_active]');
      return page(
        request,
        rules.filter(
          (r) =>
            (trigger === null || r.trigger_type === trigger) &&
            (active === null || String(r.is_active) === active),
        ),
      );
    }),

    http.post(`${base}/notification-rules`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Rule> & {
        code: string;
        trigger_type: Rule['trigger_type'];
        role_id?: string | null;
        user_id?: string | null;
      };
      const code = body.code.toUpperCase();
      if (rules.some((r) => r.code === code))
        return apiError(422, 'DUPLICATE_KEY', 'That code is already in use.', [
          { field: 'code', code: 'DUPLICATE_KEY', message: 'That code is already in use.' },
        ]);
      sequence += 1;
      const made = rule({
        id: `r${String(sequence)}`,
        code,
        name: body.name ?? code,
        trigger_type: body.trigger_type,
        description: body.description ?? null,
        condition: body.condition ?? null,
        lead_days: body.lead_days ?? null,
        recipient_rule: body.recipient_rule ?? 'approvers',
        role: body.role_id ? { id: body.role_id, code: 'ROLE', name: 'System Administrator' } : null,
        user: body.user_id ? { id: body.user_id, username: 'rahim' } : null,
        channel: body.channel ?? 'in_app',
        severity: body.severity ?? 'info',
        is_active: body.is_active ?? true,
      });
      rules.push(made);
      return ok(made, { status: 201, version: made.version });
    }),

    http.patch(`${base}/notification-rules/:id`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = rules.find((r) => r.id === params.id);
      if (!found) return apiError(404, 'NOT_FOUND', 'The rule does not exist.');
      const stale = requireIfMatch(request, found.version);
      if (stale) return stale;
      const body = (await request.json()) as Partial<Rule> & {
        role_id?: string | null;
        user_id?: string | null;
      };
      const { role_id: roleId, user_id: userId, ...rest } = body;
      Object.assign(found, rest);
      if (roleId !== undefined)
        found.role = roleId ? { id: roleId, code: 'ROLE', name: 'System Administrator' } : null;
      if (userId !== undefined) found.user = userId ? { id: userId, username: 'rahim' } : null;
      found.version += 1;
      return ok(found, { version: found.version });
    }),
  ];
}

export const handlers: RequestHandler[] = notificationMocks();
