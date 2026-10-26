import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import type { Participant, Program } from './training';

/**
 * MSW mocks of training (P2.09): the same addresses, bodies, `If-Match` rule and refusals as the backend (a draft is
 * changed, submitted and deleted; participants are within the capacity and once each; results are recorded on an
 * approved programme, and only for someone who attended).
 */

const PROFILES = {
  pr2: { id: 'pr2', profile_number: 'WRK-A-0001', full_name: 'Salma Begum' },
  pr3: { id: 'pr3', profile_number: 'WRK-A-0002', full_name: 'Jalal Mia' },
} as const;
const ESTATE = { id: 'e1', code: 'DEMO-A', name: 'Rupai Hills Tea Estate' } as const;

interface Store {
  programs: Program[];
  participants: Participant[];
  sequence: number;
}

function program(id: string, fields: Partial<Program>): Program {
  return {
    id,
    program_code: `TP-${id.toUpperCase()}`,
    estate_id: 'e1',
    estate: ESTATE,
    title: 'Safe pesticide handling',
    training_type: 'safety',
    trainer_name: 'Ms. Rahman',
    trainer_type: 'internal',
    venue: 'Factory hall',
    start_date: '2026-10-01',
    end_date: '2026-10-02',
    duration_hours: '8.00',
    capacity: 3,
    cost: '5000.0000',
    description: null,
    participant_count: 0,
    seats_left: 3,
    state: 'draft',
    approval_id: null,
    rejection_reason: null,
    cancellation_reason: null,
    version: 1,
    ...fields,
  };
}

function participant(id: string, programId: string, fields: Partial<Participant>): Participant {
  return {
    id,
    training_program_id: programId,
    program: {
      id: programId,
      program_code: `TP-${programId.toUpperCase()}`,
      title: 'Safe pesticide handling',
      start_date: '2026-10-01',
      end_date: '2026-10-02',
    },
    employment_profile_id: 'pr2',
    profile: PROFILES.pr2,
    attendance_status: 'registered',
    score: null,
    result: 'not_assessed',
    certificate_number: null,
    certificate_issued_on: null,
    feedback_rating: null,
    remarks: null,
    version: 1,
    ...fields,
  };
}

function fresh(): Store {
  return {
    sequence: 100,
    programs: [
      program('t1', {}),
      program('t2', {
        title: 'First aid',
        training_type: 'health',
        state: 'approved',
        participant_count: 1,
        seats_left: 2,
      }),
    ],
    participants: [
      participant('p1', 't2', { program: { ...participant('x', 't2', {}).program, title: 'First aid' } }),
    ],
  };
}

let store = fresh();

/** Back to the starting programmes (tests call this in beforeEach). */
export function resetTrainingMocks() {
  store = fresh();
}

export function trainingMocks(b: string): RequestHandler[] {
  const notFound = (what: string) => apiError(404, 'NOT_FOUND', `No such ${what}.`);
  const fieldError = (field: string, message: string) =>
    apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [{ field, code: 'INVALID', message }]);
  const transition = (message: string) => apiError(409, 'INVALID_TRANSITION', message);
  const replace = (next: Program) => {
    store.programs = store.programs.map((p) => (p.id === next.id ? next : p));
    return next;
  };
  /** The counts the backend derives from the registered participants. */
  const counted = (p: Program) => {
    const count = store.participants.filter(
      (x) => x.training_program_id === p.id && x.attendance_status !== 'withdrawn',
    ).length;
    return { ...p, participant_count: count, seats_left: p.capacity === null ? null : p.capacity - count };
  };
  const find = (id: unknown) => {
    const found = store.programs.find((p) => p.id === id);
    return found ? counted(found) : undefined;
  };

  return [
    http.get(`${b}/training-programs`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = store.programs.map(counted);
      for (const key of ['estate_id', 'training_type', 'state'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((p) => p[key] === wanted);
      }
      return page(request, rows);
    }),
    http.post(`${b}/training-programs`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Program>;
      if (!body.title || body.title.trim().length < 3) return fieldError('title', 'Enter a title.');
      if (body.end_date && body.start_date && body.end_date < body.start_date)
        return fieldError('end_date', 'Cannot be before start_date.');
      store.sequence += 1;
      const made = program(`tn${String(store.sequence)}`, { ...body, state: 'draft' });
      store.programs.push(made);
      return created(counted(made), `${b}/training-programs/${made.id}`, made.version);
    }),
    http.get(`${b}/training-programs/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      return found ? ok(found, { version: found.version }) : notFound('programme');
    }),
    http.patch(`${b}/training-programs/:id`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound('programme');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition('Only a draft can be changed.');
      const body = (await request.json()) as Partial<Program>;
      const next = counted(replace({ ...found, ...body, version: found.version + 1 }));
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/training-programs/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (found && found.state !== 'draft')
        return transition(`A ${found.state} programme cannot be deleted.`);
      store.programs = store.programs.filter((p) => p.id !== params.id);
      return noContent();
    }),
    http.post(`${b}/training-programs/:id/submit`, ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound('programme');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft') return transition(`A ${found.state} programme cannot be submitted.`);
      const next = counted(
        replace({ ...found, state: 'submitted', approval_id: 'ap-t', version: found.version + 1 }),
      );
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/training-programs/:id/complete`, ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound('programme');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'approved') return transition('Only an approved programme is completed.');
      const open = store.participants.some(
        (x) => x.training_program_id === found.id && x.attendance_status === 'registered',
      );
      if (open) return fieldError('attendance_status', '1 participants have no attendance recorded.');
      const next = counted(replace({ ...found, state: 'completed', version: found.version + 1 }));
      return ok(next, { version: next.version });
    }),
    http.post(`${b}/training-programs/:id/cancel`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return notFound('programme');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.state !== 'draft' && found.state !== 'approved')
        return transition(`A ${found.state} programme cannot be cancelled.`);
      const body = (await request.json()) as { reason: string };
      const next = counted(
        replace({
          ...found,
          state: 'cancelled',
          cancellation_reason: body.reason,
          version: found.version + 1,
        }),
      );
      return ok(next, { version: next.version });
    }),
    http.get(`${b}/training-programs/:id/participants`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return page(
        request,
        store.participants.filter((x) => x.training_program_id === params.id),
      );
    }),
    http.post(`${b}/training-programs/:id/participants`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      if (!found) return notFound('programme');
      if (found.state !== 'draft' && found.state !== 'approved')
        return transition(`People cannot be registered on a ${found.state} programme.`);
      const body = (await request.json()) as { employment_profile_ids: string[] };
      if (found.seats_left !== null && body.employment_profile_ids.length > found.seats_left)
        return fieldError('employment_profile_ids', `Only ${String(found.seats_left)} seats are left.`);
      const added: Participant[] = [];
      for (const id of body.employment_profile_ids) {
        if (
          store.participants.some((x) => x.training_program_id === found.id && x.employment_profile_id === id)
        )
          return apiError(422, 'DUPLICATE_KEY', 'That profile is already a participant.');
        store.sequence += 1;
        const profile = id === 'pr3' ? PROFILES.pr3 : PROFILES.pr2;
        const made = participant(`pn${String(store.sequence)}`, found.id, {
          employment_profile_id: id,
          profile,
        });
        store.participants.push(made);
        added.push(made);
      }
      return page(request, added);
    }),
    http.patch(`${b}/training-programs/:id/participants/:participantId`, async ({ request, params }) => {
      const found = find(params.id);
      const row = store.participants.find((x) => x.id === params.participantId);
      if (!found || !row) return notFound('participant');
      const refused = requireAuth(request) ?? requireIfMatch(request, row.version);
      if (refused) return refused;
      if (found.state !== 'approved')
        return transition(`Results are recorded on an approved programme, not a ${found.state} one.`);
      const body = (await request.json()) as Partial<Participant>;
      const next = { ...row, ...body, version: row.version + 1 };
      if (
        next.attendance_status !== 'attended' &&
        (next.result !== 'not_assessed' || next.score !== null || next.certificate_number !== null)
      )
        return fieldError('result', 'Only someone who attended is assessed or certified.');
      store.participants = store.participants.map((x) => (x.id === row.id ? next : x));
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/training-programs/:id/participants/:participantId`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      store.participants = store.participants.filter((x) => x.id !== params.participantId);
      return noContent();
    }),
    http.get(`${b}/employment-profiles/:id/trainings`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return page(
        request,
        store.participants.filter((x) => x.employment_profile_id === params.id),
      );
    }),
  ];
}
