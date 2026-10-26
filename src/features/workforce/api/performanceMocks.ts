import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';
import { Dec } from '@/lib/money';

import type { CalendarEvent, Evaluation, Goal, Progress } from './performance';

/**
 * MSW mocks of goals and evaluations (P2.09–P2.10): the same addresses, bodies, `If-Match` rule and refusals as the
 * backend (a draft goal is changed, submitted and deleted; progress moves an active goal and is never in the future;
 * an evaluation is scored on its criteria lines, needs every line scored to be submitted, and is acknowledged once).
 */

const PROFILES = {
  pr2: { id: 'pr2', profile_number: 'WRK-A-0001', full_name: 'Salma Begum' },
  pr3: { id: 'pr3', profile_number: 'WRK-A-0002', full_name: 'Jalal Mia' },
} as const;
const CRITERIA = {
  ec1: { id: 'ec1', code: 'JOB_KNOWLEDGE', name: 'Job knowledge', criteria_group: 'competency' },
  ec2: { id: 'ec2', code: 'QUALITY', name: 'Quality of work', criteria_group: 'performance' },
  ec3: { id: 'ec3', code: 'GOALS', name: 'Goal achievement', criteria_group: 'goals' },
} as const;

interface Store {
  goals: Goal[];
  progress: Progress[];
  evaluations: Evaluation[];
  sequence: number;
}

const two = (value: string | number) => new Dec(value).toFixed(2);

function goal(id: string, fields: Partial<Goal>): Goal {
  return {
    id,
    goal_code: `GL-${id.toUpperCase()}`,
    owner_type: 'employment_profile',
    owner_id: 'pr2',
    owner_name: 'Salma Begum',
    estate_id: 'e1',
    parent_goal_id: null,
    title: 'Pluck 40 kg a day',
    description: null,
    kpi_name: 'Kilos plucked',
    measure_unit: 'kg',
    target_value: '40.0000',
    current_value: '0.0000',
    weight: null,
    start_date: '2026-10-01',
    due_date: '2026-12-31',
    review_date: null,
    progress_percentage: two(0),
    state: 'draft',
    approval_id: null,
    completed_at: null,
    cancellation_reason: null,
    rejection_reason: null,
    version: 1,
    ...fields,
  };
}

function line(id: string, criteria: keyof typeof CRITERIA, score: string | null) {
  return {
    id,
    criteria_id: criteria,
    criteria: CRITERIA[criteria],
    goal_id: null,
    weight: two(1),
    score,
    max_score: two(5),
    weighted_score: score,
    comment: null,
    sequence: 1,
  };
}

function evaluation(id: string, fields: Partial<Evaluation>): Evaluation {
  return {
    id,
    evaluation_number: `EV-${id.toUpperCase()}`,
    employment_profile_id: 'pr2',
    profile: PROFILES.pr2,
    estate_id: 'e1',
    reviewer_profile_id: null,
    reviewer: null,
    period_start: '2026-01-01',
    period_end: '2026-06-30',
    evaluation_type: 'annual',
    overall_score: null,
    overall_rating: null,
    strengths: null,
    development_needs: null,
    reviewer_comment: null,
    employee_comment: null,
    acknowledged_at: null,
    lines: [line('l1', 'ec1', null), line('l2', 'ec2', null)],
    state: 'draft',
    is_locked: false,
    approval_id: null,
    rejection_reason: null,
    version: 1,
    ...fields,
  };
}

function fresh(): Store {
  return {
    sequence: 100,
    goals: [
      goal('g1', {}),
      goal('g2', {
        title: 'Cut wastage by 5%',
        owner_type: 'estate',
        owner_id: 'e1',
        owner_name: 'Rupai Hills Tea Estate',
        state: 'in_progress',
        progress_percentage: two(40),
        current_value: '16.0000',
        review_date: '2026-11-15',
      }),
      goal('g3', {
        title: 'Safety audit',
        state: 'overdue',
        due_date: '2026-10-10',
        progress_percentage: two(10),
      }),
    ],
    progress: [
      {
        id: 'pg1',
        goal_id: 'g2',
        progress_date: '2026-10-15',
        value: '16.0000',
        progress_percentage: two(40),
        note: 'First month',
        recorded_by: { id: 'u1', username: 'manager' },
      },
    ],
    evaluations: [
      evaluation('v1', {}),
      evaluation('v2', {
        employment_profile_id: 'pr3',
        profile: PROFILES.pr3,
        state: 'approved',
        overall_score: two(80),
        overall_rating: 'exceeds',
        lines: [line('l3', 'ec1', two(4)), line('l4', 'ec2', two(4))],
      }),
    ],
  };
}

let store = fresh();

/** Back to the starting goals and evaluations (tests call this in beforeEach). */
export function resetPerformanceMocks() {
  store = fresh();
}

export function performanceMocks(b: string): RequestHandler[] {
  const notFound = (what: string) => apiError(404, 'NOT_FOUND', `No such ${what}.`);
  const fieldError = (field: string, message: string) =>
    apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [{ field, code: 'INVALID', message }]);
  const transition = (message: string) => apiError(409, 'INVALID_TRANSITION', message);
  const putGoal = (next: Goal) => {
    store.goals = store.goals.map((g) => (g.id === next.id ? next : g));
    return next;
  };
  const putEvaluation = (next: Evaluation) => {
    store.evaluations = store.evaluations.map((e) => (e.id === next.id ? next : e));
    return next;
  };
  const overall = (lines: Evaluation['lines']) => {
    const scored = lines.filter((l) => l.score !== null);
    if (scored.length === 0) return null;
    const weights = scored.reduce((sum, l) => sum.plus(l.weight), new Dec(0));
    const total = scored.reduce(
      (sum, l) => sum.plus(new Dec(l.score ?? 0).div(l.max_score).times(l.weight)),
      new Dec(0),
    );
    return two(total.div(weights).times(100).toString());
  };

  return [
    // ---- Goals ----
    http.get(`${b}/goals/overview`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const count = (state: Goal['state'][]) => store.goals.filter((g) => state.includes(g.state)).length;
      return ok({
        total: store.goals.length,
        completed: count(['completed']),
        in_progress: count(['active', 'in_progress']),
        delayed: count(['delayed']),
        overdue: count(['overdue']),
        draft: count(['draft']),
        cancelled: count(['cancelled']),
      });
    }),
    http.get(`${b}/goals/calendar`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      const events: CalendarEvent[] = [];
      for (const g of store.goals) {
        for (const [kind, date] of [
          ['start', g.start_date],
          ['review', g.review_date],
          ['due', g.due_date],
        ] as const) {
          if (date && date >= from && date <= to)
            events.push({
              goal_id: g.id,
              goal_code: g.goal_code,
              title: g.title,
              kind,
              date,
              state: g.state,
            });
        }
      }
      return page(
        request,
        events.sort((x, y) => x.date.localeCompare(y.date)),
      );
    }),
    http.get(`${b}/goals`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = [...store.goals];
      for (const key of ['estate_id', 'state', 'owner_type'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((g) => g[key] === wanted);
      }
      return page(request, rows);
    }),
    http.post(`${b}/goals`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Goal>;
      if (!body.title || body.title.trim().length < 3) return fieldError('title', 'Enter a title.');
      if (body.due_date && body.start_date && body.due_date < body.start_date)
        return fieldError('due_date', 'Cannot be before start_date.');
      store.sequence += 1;
      const made = goal(`gn${String(store.sequence)}`, {
        ...body,
        state: 'draft',
        owner_name: 'Salma Begum',
      });
      store.goals.push(made);
      return created(made, `${b}/goals/${made.id}`, made.version);
    }),
    http.get(`${b}/goals/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.goals.find((g) => g.id === params.id);
      return found ? ok(found, { version: found.version }) : notFound('goal');
    }),
    http.patch(`${b}/goals/:id`, async ({ request, params }) => {
      const found = store.goals.find((g) => g.id === params.id);
      if (!found) return notFound('goal');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition('Only a draft goal is changed.');
      const body = (await request.json()) as Partial<Goal>;
      const next = putGoal({ ...found, ...body, version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/goals/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.goals.find((g) => g.id === params.id);
      if (found && found.state !== 'draft') return transition(`A ${found.state} goal cannot be deleted.`);
      store.goals = store.goals.filter((g) => g.id !== params.id);
      return noContent();
    }),
    http.post(`${b}/goals/:id/submit`, ({ request, params }) => {
      const found = store.goals.find((g) => g.id === params.id);
      if (!found) return notFound('goal');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition(`A ${found.state} goal cannot be submitted.`);
      const next = putGoal({ ...found, state: 'submitted', approval_id: 'ap-g', version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/goals/:id/complete`, ({ request, params }) => {
      const found = store.goals.find((g) => g.id === params.id);
      if (!found) return notFound('goal');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (['draft', 'submitted', 'completed', 'cancelled', 'rejected'].includes(found.state))
        return transition(`A ${found.state} goal cannot be completed.`);
      const next = putGoal({
        ...found,
        state: 'completed',
        progress_percentage: two(100),
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/goals/:id/cancel`, async ({ request, params }) => {
      const found = store.goals.find((g) => g.id === params.id);
      if (!found) return notFound('goal');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (['completed', 'cancelled', 'rejected'].includes(found.state))
        return transition(`A ${found.state} goal cannot be cancelled.`);
      const body = (await request.json()) as { reason: string };
      const next = putGoal({
        ...found,
        state: 'cancelled',
        cancellation_reason: body.reason,
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.get(`${b}/goals/:id/progress`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return page(
        request,
        store.progress.filter((p) => p.goal_id === params.id),
      );
    }),
    http.post(`${b}/goals/:id/progress`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.goals.find((g) => g.id === params.id);
      if (!found) return notFound('goal');
      if (!['active', 'in_progress', 'delayed', 'overdue'].includes(found.state))
        return transition(`Progress is recorded on an active goal, not a ${found.state} one.`);
      const body = (await request.json()) as {
        progress_date: string;
        value?: string | null;
        progress_percentage?: string;
        note?: string | null;
      };
      if (body.progress_date > '2026-10-25') return fieldError('progress_date', 'Cannot be in the future.');
      let percentage = body.progress_percentage ?? null;
      if (percentage === null && body.value && found.target_value)
        percentage = two(
          new Dec(body.value).div(found.target_value).times(100).toDecimalPlaces(2).toString(),
        );
      if (percentage === null)
        return fieldError(
          'progress_percentage',
          'Give the percentage (or a value, for a goal with a target).',
        );
      store.sequence += 1;
      store.progress.push({
        id: `pg${String(store.sequence)}`,
        goal_id: found.id,
        progress_date: body.progress_date,
        value: body.value ?? null,
        progress_percentage: percentage,
        note: body.note ?? null,
        recorded_by: { id: 'u1', username: 'manager' },
      });
      const next = putGoal({
        ...found,
        state: 'in_progress',
        progress_percentage: percentage,
        current_value: body.value ?? found.current_value,
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    // ---- Evaluations ----
    http.get(`${b}/evaluations`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = [...store.evaluations];
      for (const key of ['estate_id', 'state', 'evaluation_type'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((e) => e[key] === wanted);
      }
      return page(request, rows);
    }),
    http.post(`${b}/evaluations`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Evaluation> & {
        lines?: { criteria_id: string; weight?: string; score: string | null; comment: string | null }[];
      };
      if (body.period_end && body.period_start && body.period_end < body.period_start)
        return fieldError('period_end', 'Cannot be before period_start.');
      store.sequence += 1;
      const lines = (body.lines ?? []).map((l, i) => ({
        ...line(`ln${String(store.sequence)}-${String(i)}`, l.criteria_id as keyof typeof CRITERIA, l.score),
        comment: l.comment,
      }));
      const { lines: _ignored, ...head } = body;
      const made = evaluation(`vn${String(store.sequence)}`, {
        ...head,
        profile: body.employment_profile_id === 'pr3' ? PROFILES.pr3 : PROFILES.pr2,
        lines,
        overall_score: overall(lines),
        state: 'draft',
      });
      store.evaluations.push(made);
      return created(made, `${b}/evaluations/${made.id}`, made.version);
    }),
    http.get(`${b}/evaluations/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = store.evaluations.find((e) => e.id === params.id);
      return found ? ok(found, { version: found.version }) : notFound('evaluation');
    }),
    http.patch(`${b}/evaluations/:id`, async ({ request, params }) => {
      const found = store.evaluations.find((e) => e.id === params.id);
      if (!found) return notFound('evaluation');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition('Only a draft is changed.');
      const body = (await request.json()) as Partial<Evaluation>;
      if (body.period_end && body.period_start && body.period_end < body.period_start)
        return fieldError('period_end', 'Cannot be before period_start.');
      const next = putEvaluation({ ...found, ...body, version: found.version + 1 });
      return ok(next, { version: next.version });
    }),
    http.put(`${b}/evaluations/:id/lines`, async ({ request, params }) => {
      const found = store.evaluations.find((e) => e.id === params.id);
      if (!found) return notFound('evaluation');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition('Only a draft is changed.');
      const body = (await request.json()) as {
        lines: { criteria_id: string; weight?: string; score: string | null; comment: string | null }[];
      };
      for (const [i, l] of body.lines.entries())
        if (l.score !== null && new Dec(l.score).gt(5))
          return fieldError(`lines[${String(i)}].score`, 'At most 5.00.');
      const lines = body.lines.map((l, i) => ({
        ...line(`ln${String(i)}-${found.id}`, l.criteria_id as keyof typeof CRITERIA, l.score),
        weight: l.weight ?? two(1),
        comment: l.comment,
      }));
      const next = putEvaluation({
        ...found,
        lines,
        overall_score: overall(lines),
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/evaluations/:id/submit`, ({ request, params }) => {
      const found = store.evaluations.find((e) => e.id === params.id);
      if (!found) return notFound('evaluation');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition(`A ${found.state} evaluation cannot be submitted.`);
      if (found.lines.length === 0 || found.lines.some((l) => l.score === null))
        return fieldError('lines', 'Score every criterion before submitting.');
      const next = putEvaluation({
        ...found,
        state: 'submitted',
        approval_id: 'ap-v',
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/evaluations/:id/acknowledge`, async ({ request, params }) => {
      const found = store.evaluations.find((e) => e.id === params.id);
      if (!found) return notFound('evaluation');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'approved') return transition('Only an approved evaluation is acknowledged.');
      const body = (await request.json()) as { employee_comment: string | null };
      const next = putEvaluation({
        ...found,
        state: 'acknowledged',
        is_locked: true,
        acknowledged_at: '2026-10-25T10:00:00.000Z',
        employee_comment: body.employee_comment,
        version: found.version + 1,
      });
      return ok(next, { version: next.version });
    }),
  ];
}
