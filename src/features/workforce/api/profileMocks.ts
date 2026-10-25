import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import { type Bucket, type Profile, type WorkforceSummary } from './profileSchemas';

/**
 * MSW mocks of employment profiles (P2.02): the same addresses, bodies, `If-Match` rule and refusals as the backend
 * (422 DUPLICATE_KEY on a second active profile of a person and type, 409 on a separated profile).
 */

const NOW = '2026-01-01T04:00:00.000Z';
const ESTATE = { id: 'e1', code: 'DEMO-A', name: 'Rupai Hills Tea Estate' };
const ADMIN = { id: 'usr_manager', username: 'manager' };

const PEOPLE: Record<string, Profile['person']> = {
  p1: {
    id: 'p1',
    person_code: 'PRS-P1',
    full_name: 'Rahim Uddin',
    father_name: 'Karim Uddin',
    phone: '+8801711000001',
    gender: 'male',
    date_of_birth: '1985-03-12',
    national_id: '1985123456789',
    photo_document_id: null,
  },
  p2: {
    id: 'p2',
    person_code: 'PRS-P2',
    full_name: 'Salma Begum',
    father_name: null,
    phone: '+8801711000002',
    gender: 'female',
    date_of_birth: '1990-07-01',
    national_id: '1990987654321',
    photo_document_id: null,
  },
  p3: {
    id: 'p3',
    person_code: 'PRS-P3',
    full_name: 'Jalal Mia',
    father_name: 'Rashid Mia',
    phone: null,
    gender: 'male',
    date_of_birth: '1979-01-25',
    national_id: null,
    photo_document_id: null,
  },
  p_ref: {
    id: 'p_ref',
    person_code: 'PRS-P_REF',
    full_name: 'Nasima Khatun',
    father_name: null,
    phone: null,
    gender: 'female',
    date_of_birth: null,
    national_id: null,
    photo_document_id: null,
  },
};

const CATEGORIES = {
  c1: { code: 'GENERAL', name: 'General worker' },
  c2: { code: 'SKILLED', name: 'Skilled worker' },
  c3: { code: 'OFFICER', name: 'Officer' },
} as const;
const category = (id: keyof typeof CATEGORIES) => ({ id, ...CATEGORIES[id] });

function profile(
  id: string,
  personId: string,
  fields: Partial<Profile> & Pick<Profile, 'employment_type' | 'profile_number'>,
): Profile {
  return {
    id,
    person_id: personId,
    person: PEOPLE[personId] ?? PEOPLE.p1,
    estate_id: ESTATE.id,
    estate: ESTATE,
    category_id: null,
    category: null,
    engagement_type: 'permanent',
    employment_basis: 'full_time',
    job_nature: 'field',
    working_location: 'field',
    job_grade_id: null,
    job_grade: null,
    work_email: null,
    joining_date: '2020-01-10',
    confirmation_date: null,
    probation_end_date: null,
    on_probation: false,
    separation_date: null,
    separation_type: null,
    separation_reason: null,
    supervisor_profile_id: null,
    supervisor: null,
    is_service_continuous: true,
    service_years: 6.8,
    nominee_name: null,
    nominee_relation: null,
    nominee_date_of_birth: null,
    nominee_national_id: null,
    nominee_phone: null,
    nominee_address: null,
    remarks: null,
    current_assignment: null,
    status: 'active',
    user: null,
    created_by: ADMIN,
    version: 1,
    created_at: NOW,
    updated_at: null,
    ...fields,
  } as Profile;
}

interface Store {
  profiles: Profile[];
  sequence: number;
}

function fresh(): Store {
  const boss = profile('pr1', 'p1', {
    employment_type: 'employee',
    profile_number: 'EMP-A-0001',
    category_id: 'c3',
    category: category('c3'),
    joining_date: '2010-05-01',
    service_years: 16.4,
    user: { id: 'u8', username: 'approver' },
    current_assignment: {
      id: 'a1',
      effective_from: '2010-05-01',
      department: { id: 'd7', code: 'FIELD_OPS', name: 'Field Operations' },
      designation: { id: 'g7', code: 'FIELD_SUPERVISOR', name: 'Field Supervisor' },
      division: null,
      section: null,
      activity_type: null,
      wage_basis: 'monthly',
    },
  });
  return {
    sequence: 100,
    profiles: [
      boss,
      profile('pr2', 'p2', {
        employment_type: 'worker',
        profile_number: 'WRK-A-0001',
        category_id: 'c1',
        category: category('c1'),
        engagement_type: 'seasonal',
        joining_date: '2025-09-20',
        service_years: 1.1,
        supervisor_profile_id: 'pr1',
        supervisor: { id: 'pr1', profile_number: 'EMP-A-0001', full_name: 'Rahim Uddin' },
        current_assignment: {
          id: 'a2',
          effective_from: '2025-09-20',
          department: null,
          designation: null,
          division: null,
          section: { id: 's1', code: 'N1', name: 'North 1' },
          activity_type: null,
          wage_basis: 'daily',
        },
      }),
      profile('pr3', 'p3', {
        employment_type: 'worker',
        profile_number: 'WRK-A-0002',
        category_id: 'c2',
        category: category('c2'),
        status: 'on_leave',
        joining_date: '2012-03-01',
        service_years: 14.6,
      }),
    ],
  };
}

let store = fresh();

/** Back to the starting profiles (tests call this in beforeEach). */
export function resetProfileMocks() {
  store = fresh();
}

const bucketsOf = (rows: readonly Profile[], key: (p: Profile) => string, label?: (k: string) => string) => {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts].map(([k, count]): Bucket => ({ key: k, label: label ? label(k) : k, count }));
};

function summaryOf(rows: readonly Profile[]): WorkforceSummary {
  const live = rows.filter((p) => p.status !== 'separated');
  const count = (status: Profile['status']) => rows.filter((p) => p.status === status).length;
  const pct = (n: number) => (live.length === 0 ? '0.00' : ((n / live.length) * 100).toFixed(2));
  const tenure =
    live.length === 0 ? null : (live.reduce((sum, p) => sum + p.service_years, 0) / live.length).toFixed(1);
  const age = (p: Profile) => {
    const dob = p.person.date_of_birth;
    const years = dob ? 2026 - Number.parseInt(dob.slice(0, 4), 10) : null;
    if (years === null) return 'unknown';
    return years < 25
      ? 'under_25'
      : years < 35
        ? '25_35'
        : years < 45
          ? '35_45'
          : years < 55
            ? '45_55'
            : '55_plus';
  };
  const service = (p: Profile) =>
    p.service_years < 1
      ? '0_1'
      : p.service_years < 3
        ? '1_3'
        : p.service_years < 5
          ? '3_5'
          : p.service_years < 10
            ? '5_10'
            : '10_plus';
  return {
    total: live.length,
    active: count('active'),
    on_leave: count('on_leave'),
    suspended: count('suspended'),
    separated: count('separated'),
    active_pct: pct(count('active')),
    on_leave_pct: pct(count('on_leave')),
    new_this_month: 1,
    exits_this_month: 0,
    average_tenure_years: tenure,
    by_category: bucketsOf(
      live,
      (p) => p.category?.code ?? 'none',
      (k) => Object.values(CATEGORIES).find((c) => c.code === k)?.name ?? k,
    ),
    by_department: bucketsOf(
      live,
      (p) => p.current_assignment?.department?.code ?? 'none',
      (k) => (k === 'none' ? 'Not set' : k),
    ),
    by_engagement_type: bucketsOf(live, (p) => p.engagement_type),
    by_gender: bucketsOf(live, (p) => p.person.gender ?? 'unknown'),
    by_age_group: bucketsOf(live, age, (k) => k),
    by_length_of_service: bucketsOf(live, service, (k) => k),
    birthdays_this_month: [{ profile_id: 'pr1', full_name: 'Rahim Uddin', date: '2026-10-28' }],
    anniversaries_this_month: [{ profile_id: 'pr2', full_name: 'Salma Begum', date: '2026-10-20', years: 1 }],
  };
}

export function profileMocks(b: string): RequestHandler[] {
  const find = (id: unknown) => store.profiles.find((p) => p.id === id);
  const replace = (next: Profile) => {
    store.profiles = store.profiles.map((p) => (p.id === next.id ? next : p));
    return next;
  };
  const separatedRefusal = () => apiError(409, 'CONFLICT', 'A separated profile cannot be changed.');
  const reasonRefusal = () =>
    apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
      { field: 'reason', code: 'TOO_SHORT', message: 'Give a reason of at least 3 characters.' },
    ]);

  return [
    http.get(`${b}/employment-profiles`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      const get = (k: string) => url.searchParams.get(`filter[${k}]`);
      let rows = [...store.profiles];
      for (const key of ['employment_type', 'estate_id', 'engagement_type', 'category_id'] as const) {
        const wanted = get(key);
        if (wanted) rows = rows.filter((p) => p[key] === wanted);
      }
      const status = get('status');
      if (status) rows = rows.filter((p) => p.status === status);
      const statusIn = url.searchParams.get('filter[status][in]');
      if (statusIn) rows = rows.filter((p) => statusIn.split(',').includes(p.status));
      const q = get('q')?.toLowerCase();
      if (q)
        rows = rows.filter(
          (p) =>
            p.person.full_name.toLowerCase().includes(q) ||
            p.profile_number.toLowerCase().includes(q) ||
            (p.person.phone ?? '').includes(q),
        );
      const sort = url.searchParams.get('sort') ?? '-joining_date';
      const key = sort.replace(/^-/, '');
      const text = (p: Profile) => {
        const value = (p as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : '';
      };
      rows.sort((x, y) => text(x).localeCompare(text(y)) * (sort.startsWith('-') ? -1 : 1));
      return page(request, rows);
    }),
    http.get(`${b}/employment-profiles/summary`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      const type = url.searchParams.get('employment_type');
      const estate = url.searchParams.get('estate_id');
      return ok(
        summaryOf(
          store.profiles.filter(
            (p) => (!type || p.employment_type === type) && (!estate || p.estate_id === estate),
          ),
        ),
      );
    }),
    http.post(`${b}/employment-profiles`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Record<string, unknown>;
      const personId = typeof body.person_id === 'string' ? body.person_id : '';
      const type = body.employment_type as Profile['employment_type'];
      if (
        store.profiles.some(
          (p) => p.person_id === personId && p.employment_type === type && p.status !== 'separated',
        )
      )
        return apiError(422, 'DUPLICATE_KEY', 'This person already has an active profile of this type.', [
          { field: 'person_id', code: 'DUPLICATE', message: 'Already has an active profile.' },
        ]);
      store.sequence += 1;
      const made = profile(`pr${String(store.sequence)}`, personId, {
        employment_type: type,
        profile_number:
          typeof body.profile_number === 'string' && body.profile_number !== ''
            ? body.profile_number
            : `${type === 'worker' ? 'WRK' : 'EMP'}-A-${String(store.sequence).padStart(4, '0')}`,
        ...(body as Partial<Profile>),
      });
      store.profiles.push(made);
      return created(made, `${b}/employment-profiles/${made.id}`, made.version);
    }),
    http.get(`${b}/employment-profiles/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      return found ? ok(found, { version: found.version }) : apiError(404, 'NOT_FOUND', 'No such profile.');
    }),
    http.put(`${b}/employment-profiles/:id`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return apiError(404, 'NOT_FOUND', 'No such profile.');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      if (found.status === 'separated') return separatedRefusal();
      const body = (await request.json()) as Partial<Profile>;
      return ok(replace({ ...found, ...body, version: found.version + 1, updated_at: NOW }), {
        version: found.version + 1,
      });
    }),
    ...(['suspend', 'reinstate', 'separate'] as const).map((action) =>
      http.post(`${b}/employment-profiles/:id/${action}`, async ({ request, params }) => {
        const found = find(params.id);
        if (!found) return apiError(404, 'NOT_FOUND', 'No such profile.');
        const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
        if (refused) return refused;
        if (found.status === 'separated') return separatedRefusal();
        const body = (await request.json()) as {
          reason?: string;
          separation_date?: string;
          separation_type?: Profile['separation_type'];
        };
        if (!body.reason || body.reason.trim().length < 3) return reasonRefusal();
        const next: Profile = {
          ...found,
          status: action === 'suspend' ? 'suspended' : action === 'reinstate' ? 'active' : 'separated',
          ...(action === 'separate'
            ? {
                separation_date: body.separation_date ?? null,
                separation_type: body.separation_type ?? null,
                separation_reason: body.reason,
              }
            : {}),
          version: found.version + 1,
        };
        return ok(replace(next), { version: next.version });
      }),
    ),
    http.delete(`${b}/employment-profiles/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      store.profiles = store.profiles.filter((p) => p.id !== params.id);
      return noContent();
    }),
    http.get(`${b}/persons/:id/employment-profiles`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return ok(store.profiles.filter((p) => p.person_id === params.id));
    }),
    http.get(`${b}/persons/:id/service-summary`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const mine = store.profiles.filter((p) => p.person_id === params.id);
      return ok({
        person_id: String(params.id),
        profiles: mine.length,
        continuous_service_days: mine.length * 365,
        total_service_days: mine.length * 365,
        first_joining_date: mine[0]?.joining_date ?? null,
        current_profile_id: mine.find((p) => p.status !== 'separated')?.id ?? null,
      });
    }),
  ];
}
