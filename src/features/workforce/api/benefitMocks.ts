import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';
import { Dec } from '@/lib/money';

import type { BenefitEntitlement, BenefitIssue, WelfareCase } from './benefits';

/**
 * MSW mocks of benefits and welfare (P2.08): the same addresses, bodies, `If-Match` rule and refusals as the backend
 * (a draft is changed and submitted for approval, an issue outside its entitlement or repeated on a date is refused, a
 * disbursement cannot exceed what remains of the approved amount).
 */

const PROFILES = {
  pr2: { id: 'pr2', profile_number: 'WRK-A-0001', full_name: 'Salma Begum' },
  pr3: { id: 'pr3', profile_number: 'WRK-A-0002', full_name: 'Jalal Mia' },
} as const;
const TYPES = {
  bt1: {
    id: 'bt1',
    code: 'HOUSING',
    name: 'Housing',
    benefit_category: 'housing',
    payroll_treatment: 'not_payroll',
  },
  bt2: {
    id: 'bt2',
    code: 'RATION',
    name: 'Ration',
    benefit_category: 'ration',
    payroll_treatment: 'not_payroll',
  },
} as const;

const four = (value: string | number) => new Dec(value).toFixed(4);

interface Store {
  entitlements: BenefitEntitlement[];
  issues: BenefitIssue[];
  cases: WelfareCase[];
  sequence: number;
}

function entitlement(id: string, fields: Partial<BenefitEntitlement>): BenefitEntitlement {
  return {
    id,
    employment_profile_id: 'pr2',
    profile: PROFILES.pr2,
    estate_id: 'e1',
    benefit_type_id: 'bt2',
    benefit_type: TYPES.bt2,
    effective_from: '2026-10-01',
    effective_to: null,
    quantity_per_period: '3.500',
    employer_cost_per_period: four(120),
    employee_contribution: four(0),
    allocation_reference: 'RC-1001',
    issuing_office: 'Lalbagh ration dealer',
    withdrawal_reason: null,
    state: 'approved',
    is_current: true,
    approval_id: null,
    rejection_reason: null,
    version: 1,
    ...fields,
  };
}

function welfare(id: string, fields: Partial<WelfareCase>): WelfareCase {
  return {
    id,
    case_number: `WC-${id.toUpperCase()}`,
    estate_id: 'e1',
    beneficiary_type: 'employment_profile',
    beneficiary_id: 'pr2',
    beneficiary_name: 'Salma Begum',
    welfare_category: 'medical',
    case_date: '2026-10-20',
    description: 'Eye surgery',
    requested_amount: four(15000),
    approved_amount: null,
    disbursed_amount: four(0),
    remaining_amount: null,
    outcome: null,
    state: 'draft',
    approval_id: null,
    rejection_reason: null,
    version: 1,
    ...fields,
  };
}

function fresh(): Store {
  return {
    sequence: 100,
    entitlements: [
      entitlement('be1', {}),
      entitlement('be2', {
        employment_profile_id: 'pr3',
        profile: PROFILES.pr3,
        state: 'draft',
        is_current: false,
        allocation_reference: 'RC-1002',
      }),
    ],
    issues: [],
    cases: [
      welfare('w1', {}),
      welfare('w2', {
        description: 'School fees',
        welfare_category: 'education',
        state: 'approved',
        approved_amount: four(10000),
        remaining_amount: four(10000),
      }),
    ],
  };
}

let store = fresh();

/** Back to the starting benefits (tests call this in beforeEach). */
export function resetBenefitMocks() {
  store = fresh();
}

export function benefitMocks(b: string): RequestHandler[] {
  const notFound = (what: string) => apiError(404, 'NOT_FOUND', `No such ${what}.`);
  const onlyDraft = () => apiError(409, 'INVALID_TRANSITION', 'Only a draft can be changed.');
  const fieldError = (field: string, message: string) =>
    apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [{ field, code: 'INVALID', message }]);
  const replaceE = (next: BenefitEntitlement) => {
    store.entitlements = store.entitlements.map((e) => (e.id === next.id ? next : e));
    return next;
  };
  const replaceI = (next: BenefitIssue) => {
    store.issues = store.issues.map((i) => (i.id === next.id ? next : i));
    return next;
  };
  const replaceC = (next: WelfareCase) => {
    store.cases = store.cases.map((c) => (c.id === next.id ? next : c));
    return next;
  };

  return [
    // ---- Entitlements ----
    http.get(`${b}/benefit-entitlements`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = [...store.entitlements];
      for (const key of ['estate_id', 'benefit_type_id', 'state', 'employment_profile_id'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((e) => e[key] === wanted);
      }
      return page(request, rows);
    }),
    http.post(`${b}/benefit-entitlements`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<BenefitEntitlement> & { employment_profile_id: string };
      if (body.effective_to && body.effective_from && body.effective_to < body.effective_from)
        return fieldError('effective_to', 'Valid till cannot be before the issue date.');
      store.sequence += 1;
      const profile = body.employment_profile_id === 'pr3' ? PROFILES.pr3 : PROFILES.pr2;
      const type = body.benefit_type_id === 'bt1' ? TYPES.bt1 : TYPES.bt2;
      const made = entitlement(`bn${String(store.sequence)}`, {
        ...body,
        profile,
        employment_profile_id: profile.id,
        benefit_type: type,
        state: 'draft',
        is_current: false,
      });
      store.entitlements.push(made);
      return created(made, `${b}/benefit-entitlements/${made.id}`, made.version);
    }),
    http.get(`${b}/benefit-entitlements/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.entitlements.find((e) => e.id === params.id);
      return found ? ok(found, { version: found.version }) : notFound('entitlement');
    }),
    http.patch(`${b}/benefit-entitlements/:id`, async ({ request, params }) => {
      const found = store.entitlements.find((e) => e.id === params.id);
      if (!found) return notFound('entitlement');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const body = (await request.json()) as Partial<BenefitEntitlement>;
      const next = replaceE({ ...found, ...body, version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/benefit-entitlements/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.entitlements.find((e) => e.id === params.id);
      if (found && found.state !== 'draft') return onlyDraft();
      store.entitlements = store.entitlements.filter((e) => e.id !== params.id);
      return noContent();
    }),
    http.post(`${b}/benefit-entitlements/:id/submit`, ({ request, params }) => {
      const found = store.entitlements.find((e) => e.id === params.id);
      if (!found) return notFound('entitlement');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const next = replaceE({
        ...found,
        state: 'submitted',
        approval_id: 'ap-b',
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/benefit-entitlements/:id/withdraw`, async ({ request, params }) => {
      const found = store.entitlements.find((e) => e.id === params.id);
      if (!found) return notFound('entitlement');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { effective_to: string; reason: string };
      if (found.state !== 'approved')
        return apiError(409, 'INVALID_TRANSITION', 'Only an approved entitlement can be withdrawn.');
      if (!body.reason || body.reason.trim().length < 3)
        return fieldError('reason', 'Give a reason of at least 3 characters.');
      const next = replaceE({
        ...found,
        state: 'withdrawn',
        is_current: false,
        effective_to: body.effective_to,
        withdrawal_reason: body.reason,
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),

    // ---- Issues ----
    http.get(`${b}/benefit-issues`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = [...store.issues];
      for (const key of ['estate_id', 'state'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((i) => i[key] === wanted);
      }
      return page(request, rows);
    }),
    http.post(`${b}/benefit-issues/generate`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as {
        benefit_type_id: string;
        estate_id: string;
        issue_date: string;
        period_reference: string | null;
      };
      const current = store.entitlements.filter(
        (e) => e.benefit_type_id === body.benefit_type_id && e.estate_id === body.estate_id && e.is_current,
      );
      let createdCount = 0;
      let existing = 0;
      for (const e of current) {
        if (store.issues.some((i) => i.benefit_entitlement_id === e.id && i.issue_date === body.issue_date)) {
          existing += 1;
          continue;
        }
        store.sequence += 1;
        store.issues.push({
          id: `bi${String(store.sequence)}`,
          benefit_entitlement_id: e.id,
          profile: e.profile,
          benefit_type: e.benefit_type,
          estate_id: e.estate_id,
          issue_date: body.issue_date,
          period_reference: body.period_reference,
          quantity: e.quantity_per_period,
          employer_cost: e.employer_cost_per_period ?? four(0),
          employee_contribution: e.employee_contribution,
          state: 'draft',
          approval_id: null,
          rejection_reason: null,
          version: 1,
        });
        createdCount += 1;
      }
      return ok({ created: createdCount, existing });
    }),
    http.post(`${b}/benefit-issues/:id/submit`, ({ request, params }) => {
      const found = store.issues.find((i) => i.id === params.id);
      if (!found) return notFound('issue');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const next = replaceI({
        ...found,
        state: 'submitted',
        approval_id: 'ap-i',
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/benefit-issues/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.issues.find((i) => i.id === params.id);
      if (found && found.state !== 'draft') return onlyDraft();
      store.issues = store.issues.filter((i) => i.id !== params.id);
      return noContent();
    }),

    // ---- Welfare cases ----
    http.get(`${b}/welfare-cases`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = [...store.cases];
      for (const key of ['estate_id', 'welfare_category', 'state'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((c) => c[key] === wanted);
      }
      return page(request, rows);
    }),
    http.post(`${b}/welfare-cases`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<WelfareCase>;
      if (!body.description || body.description.trim().length < 3)
        return fieldError('description', 'Describe the case in a few words.');
      store.sequence += 1;
      const made = welfare(`wn${String(store.sequence)}`, {
        ...body,
        beneficiary_name: body.beneficiary_type === 'community' ? null : 'Salma Begum',
        state: 'draft',
      });
      store.cases.push(made);
      return created(made, `${b}/welfare-cases/${made.id}`, made.version);
    }),
    http.get(`${b}/welfare-cases/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.cases.find((c) => c.id === params.id);
      return found ? ok(found, { version: found.version }) : notFound('case');
    }),
    http.patch(`${b}/welfare-cases/:id`, async ({ request, params }) => {
      const found = store.cases.find((c) => c.id === params.id);
      if (!found) return notFound('case');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      const body = (await request.json()) as Partial<WelfareCase>;
      const next = replaceC({ ...found, ...body, version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/welfare-cases/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.cases.find((c) => c.id === params.id);
      if (found && found.state !== 'draft') return onlyDraft();
      store.cases = store.cases.filter((c) => c.id !== params.id);
      return noContent();
    }),
    http.post(`${b}/welfare-cases/:id/submit`, ({ request, params }) => {
      const found = store.cases.find((c) => c.id === params.id);
      if (!found) return notFound('case');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return onlyDraft();
      if (found.requested_amount === null)
        return fieldError('requested_amount', 'Enter the amount asked for.');
      const next = replaceC({
        ...found,
        state: 'submitted',
        approval_id: 'ap-w',
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/welfare-cases/:id/disburse`, async ({ request, params }) => {
      const found = store.cases.find((c) => c.id === params.id);
      if (!found) return notFound('case');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { amount: string };
      if (found.state !== 'approved')
        return apiError(409, 'INVALID_TRANSITION', 'Only an approved case is paid.');
      const left = new Dec(found.remaining_amount ?? '0');
      if (new Dec(body.amount).gt(left))
        return fieldError('amount', `At most ${left.toFixed(2)} remains to be paid.`);
      const next = replaceC({
        ...found,
        disbursed_amount: new Dec(found.disbursed_amount).plus(body.amount).toFixed(4),
        remaining_amount: left.minus(body.amount).toFixed(4),
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/welfare-cases/:id/close`, async ({ request, params }) => {
      const found = store.cases.find((c) => c.id === params.id);
      if (!found) return notFound('case');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { outcome: string };
      if (found.state !== 'approved')
        return apiError(409, 'INVALID_TRANSITION', 'Only an approved case is closed.');
      const next = replaceC({ ...found, state: 'closed', outcome: body.outcome, version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
  ];
}
