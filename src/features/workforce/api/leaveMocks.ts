import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';
import { Dec } from '@/lib/money';

import type { Entitlement, Leave } from './leave';

/**
 * MSW mocks of leave (P2.07): the same addresses, bodies, `If-Match` rule and refusals as the backend (a draft is
 * changed, a submitted request waits for approval, 422 INSUFFICIENT_BALANCE with the numbers when it does not fit,
 * field errors on the dates).
 */

const NOW = '2026-01-01T04:00:00.000Z';
const ADMIN = { id: 'usr_manager', username: 'manager' };
const ME = { id: 'pr2', profile_number: 'WRK-A-0001', full_name: 'Salma Begum' };
const TYPES = {
  lv1: { id: 'lv1', code: 'CASUAL', name: 'Casual leave' },
  lv2: { id: 'lv2', code: 'EARNED', name: 'Earned leave' },
} as const;

interface Store {
  leaves: Leave[];
  entitlements: Entitlement[];
  sequence: number;
}

const four = (value: string | number) => new Dec(value).toFixed(4);

function entitlement(
  id: string,
  type: 'lv1' | 'lv2',
  entitled: string,
  extra: Partial<Entitlement> = {},
): Entitlement {
  return {
    id,
    employment_profile_id: ME.id,
    profile: ME,
    leave_type_id: type,
    leave_type: TYPES[type],
    fiscal_year_id: 'fy1',
    fiscal_year: { id: 'fy1', code: 'FY2026-27' },
    entitled_days: four(entitled),
    carried_forward_days: four(0),
    adjustment_days: four(0),
    adjustment_reason: null,
    total_available: four(entitled),
    consumed_days: four(0),
    encashed_days: four(0),
    pending_days: four(0),
    balance_days: four(entitled),
    available_to_request: four(entitled),
    allows_negative_balance: false,
    version: 1,
    ...extra,
  };
}

function leave(id: string, fields: Partial<Leave>): Leave {
  return {
    id,
    request_number: `LV-${id.toUpperCase()}`,
    employment_profile_id: ME.id,
    profile: ME,
    estate_id: 'e1',
    leave_type_id: 'lv1',
    leave_type: TYPES.lv1,
    from_date: '2026-11-01',
    to_date: '2026-11-02',
    day_count: four(2),
    is_half_day: false,
    is_paid: true,
    reason: null,
    contact_during_leave: null,
    covering_profile_id: null,
    covering: null,
    leave_entitlement_id: 'en1',
    balance_days: four(10),
    state: 'draft',
    approval_id: null,
    rejection_reason: null,
    cancellation_reason: null,
    approved_at: null,
    cancelled_at: null,
    created_by: ADMIN,
    version: 1,
    created_at: NOW,
    ...fields,
  };
}

function fresh(): Store {
  return {
    sequence: 100,
    leaves: [
      leave('a1', {
        state: 'approved',
        from_date: '2026-09-01',
        to_date: '2026-09-03',
        day_count: four(3),
        approved_at: NOW,
      }),
    ],
    entitlements: [
      entitlement('en1', 'lv1', '10', {
        consumed_days: four(3),
        total_available: four(10),
        balance_days: four(7),
        available_to_request: four(7),
      }),
      entitlement('en2', 'lv2', '18'),
    ],
  };
}

let store = fresh();

/** Back to the starting leave (tests call this in beforeEach). */
export function resetLeaveMocks() {
  store = fresh();
}

/** The days a request counts: its calendar days, a half day being 0.5 (weekly offs are the server's business). */
function daysOf(from: string, to: string, half: boolean): string {
  if (half) return four('0.5');
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return four(Math.round((b - a) / 86_400_000) + 1);
}

export function leaveMocks(b: string): RequestHandler[] {
  const find = (id: unknown) => store.leaves.find((l) => l.id === id);
  const replace = (next: Leave) => {
    store.leaves = store.leaves.map((l) => (l.id === next.id ? next : l));
    return next;
  };
  const notFound = () => apiError(404, 'NOT_FOUND', 'No such leave request.');
  const onlyDraft = () => apiError(409, 'INVALID_TRANSITION', 'Only a draft can be changed.');
  const fieldError = (field: string, message: string) =>
    apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [{ field, code: 'INVALID', message }]);
  /** The checks both a new request and a changed draft go through. */
  const check = (body: { from_date?: string; to_date?: string; is_half_day?: boolean }) => {
    if (body.from_date && body.to_date && body.to_date < body.from_date)
      return fieldError('to_date', 'The last day cannot be before the first day.');
    if (body.is_half_day && body.from_date !== body.to_date)
      return fieldError('is_half_day', 'A half day needs a single day.');
    return null;
  };

  return [
    http.get(`${b}/leave-requests`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = [...store.leaves];
      for (const key of ['state', 'estate_id', 'employment_profile_id'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((l) => l[key] === wanted);
      }
      rows.sort((x, y) => y.created_at.localeCompare(x.created_at) || y.id.localeCompare(x.id));
      return page(request, rows);
    }),
    http.post(`${b}/leave-requests`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Leave> & { is_half_day?: boolean };
      const invalid = check(body);
      if (invalid) return invalid;
      const type = body.leave_type_id === 'lv2' ? 'lv2' : 'lv1';
      store.sequence += 1;
      const made = leave(`n${String(store.sequence)}`, {
        ...body,
        leave_type_id: type,
        leave_type: TYPES[type],
        day_count: daysOf(body.from_date ?? '', body.to_date ?? '', body.is_half_day === true),
        state: 'draft',
      });
      store.leaves.push(made);
      return created(made, `${b}/leave-requests/${made.id}`, made.version);
    }),
    http.get(`${b}/leave-requests/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      return found ? ok(found, { version: found.version }) : notFound();
    }),
    http.patch(`${b}/leave-requests/:id`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const body = (await request.json()) as Partial<Leave>;
      const merged = { ...found, ...body };
      const invalid = check(merged);
      if (invalid) return invalid;
      const type = merged.leave_type_id === 'lv2' ? 'lv2' : 'lv1';
      const next = replace({
        ...merged,
        leave_type: TYPES[type],
        day_count: daysOf(merged.from_date, merged.to_date, merged.is_half_day),
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/leave-requests/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (found && found.state !== 'draft') return onlyDraft();
      store.leaves = store.leaves.filter((l) => l.id !== params.id);
      return noContent();
    }),
    http.post(`${b}/leave-requests/:id/submit`, ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const en = store.entitlements.find(
        (e) =>
          e.employment_profile_id === found.employment_profile_id && e.leave_type_id === found.leave_type_id,
      );
      if (en && new Dec(found.day_count).gt(en.available_to_request) && !en.allows_negative_balance)
        return apiError(422, 'INSUFFICIENT_BALANCE', 'The balance does not cover this leave.', [
          {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Not enough leave left.',
            context: {
              balance_days: en.balance_days,
              pending_days: en.pending_days,
              available_days: en.available_to_request,
              requested_days: found.day_count,
            },
          },
        ]);
      if (en)
        store.entitlements = store.entitlements.map((e) =>
          e.id === en.id
            ? {
                ...e,
                pending_days: new Dec(e.pending_days).plus(found.day_count).toFixed(4),
                available_to_request: new Dec(e.available_to_request).minus(found.day_count).toFixed(4),
              }
            : e,
        );
      const next = replace({ ...found, state: 'submitted', approval_id: 'ap-l', version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/leave-requests/:id/cancel`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'approved')
        return apiError(409, 'INVALID_TRANSITION', 'Only approved leave can be cancelled.');
      const body = (await request.json()) as { reason?: string };
      if (!body.reason || body.reason.trim().length < 3)
        return fieldError('reason', 'Give a reason of at least 3 characters.');
      const next = replace({
        ...found,
        state: 'cancelled',
        cancellation_reason: body.reason,
        cancelled_at: NOW,
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),

    // ---- Balances ----
    http.get(`${b}/leave-entitlements`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      const year = url.searchParams.get('filter[fiscal_year_id]');
      const profile = url.searchParams.get('filter[employment_profile_id]');
      return page(
        request,
        store.entitlements.filter(
          (e) => (!year || e.fiscal_year_id === year) && (!profile || e.employment_profile_id === profile),
        ),
      );
    }),
    http.post(`${b}/leave-entitlements/generate`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as { fiscal_year_id: string };
      return ok({ fiscal_year_id: body.fiscal_year_id, created: 4, existing: store.entitlements.length });
    }),
    http.post(`${b}/leave-entitlements/:id/adjust`, async ({ request, params }) => {
      const found = store.entitlements.find((e) => e.id === params.id);
      if (!found) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { adjustment_days: string; reason: string };
      if (!body.reason || body.reason.trim().length < 3)
        return fieldError('reason', 'Give a reason of at least 3 characters.');
      const total = new Dec(found.entitled_days).plus(found.carried_forward_days).plus(body.adjustment_days);
      const next: Entitlement = {
        ...found,
        adjustment_days: new Dec(body.adjustment_days).toFixed(4),
        adjustment_reason: body.reason,
        total_available: total.toFixed(4),
        balance_days: total.minus(found.consumed_days).toFixed(4),
        available_to_request: total.minus(found.consumed_days).minus(found.pending_days).toFixed(4),
        version: found.version + 1,
      };
      store.entitlements = store.entitlements.map((e) => (e.id === next.id ? next : e));
      return ok(next, { version: next.version });
    }),
  ];
}
