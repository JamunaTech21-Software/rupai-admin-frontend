import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import { contractorMocks, resetContractorMocks } from './contractorMocks';
import { profileMocks, resetProfileMocks } from './profileMocks';
import { resetTeamMocks, teamMocks } from './teamMocks';
import { type Dependent, type Person } from './schemas';

/**
 * MSW mocks of the person registry (P2.01), for development and tests: the same addresses, bodies, `If-Match` rule
 * and refusals as the backend (422 DUPLICATE_KEY on a national id, 422 REFERENCED_RECORD on a person in use).
 */

const NOW = '2026-01-01T04:00:00.000Z';
const ADMIN = { id: 'usr_manager', username: 'manager' };

const person = (id: string, fields: Partial<Person> & Pick<Person, 'first_name'>): Person => {
  const full = [fields.first_name, fields.middle_name, fields.last_name].filter(Boolean).join(' ');
  return {
    id,
    person_code: `PRS-${id.toUpperCase()}`,
    registered_estate_id: '1',
    title: null,
    middle_name: null,
    last_name: null,
    full_name: full,
    father_name: null,
    mother_name: null,
    spouse_name: null,
    date_of_birth: null,
    age: null,
    gender: null,
    marital_status: null,
    blood_group: null,
    nationality_country_id: null,
    nationality: null,
    religion_id: null,
    religion: null,
    national_id: null,
    birth_certificate_no: null,
    passport_no: null,
    driving_license_no: null,
    tin: null,
    phone: null,
    alternate_phone: null,
    personal_email: null,
    present_address: null,
    present_district: null,
    present_upazila: null,
    present_postal_code: null,
    permanent_address: null,
    permanent_district: null,
    permanent_upazila: null,
    permanent_postal_code: null,
    education_level_id: null,
    education_level: null,
    skills: [],
    languages: [],
    experience_years: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_alt_phone: null,
    emergency_contact_relation: null,
    emergency_contact_address: null,
    payment_method: null,
    bank_name: null,
    bank_branch: null,
    bank_account_number: null,
    mobile_banking_provider: null,
    mobile_banking_number: null,
    remarks: null,
    dependent_count: 0,
    status: 'active',
    created_by: ADMIN,
    version: 1,
    created_at: NOW,
    updated_at: null,
    ...fields,
  };
};

interface Store {
  persons: Person[];
  dependents: Dependent[];
  sequence: number;
}

function fresh(): Store {
  return {
    sequence: 100,
    persons: [
      person('p1', {
        first_name: 'Rahim',
        last_name: 'Uddin',
        title: 'mr',
        gender: 'male',
        date_of_birth: '1985-03-12',
        age: 41,
        national_id: '1985123456789',
        phone: '+8801711000001',
        father_name: 'Karim Uddin',
        present_district: 'Moulvibazar',
        skills: [{ id: 's1', code: 'PLUCKING', name: 'Plucking' }],
        languages: [{ id: 'l1', code: 'BN', name: 'Bangla' }],
        dependent_count: 2,
        version: 3,
      }),
      person('p2', {
        first_name: 'Salma',
        last_name: 'Begum',
        title: 'mrs',
        gender: 'female',
        date_of_birth: '1990-07-01',
        age: 36,
        national_id: '1990987654321',
        phone: '+8801711000002',
      }),
      person('p3', { first_name: 'Jalal', last_name: 'Mia', gender: 'male', status: 'inactive' }),
      person('p_ref', { first_name: 'Nasima', last_name: 'Khatun', gender: 'female' }),
    ],
    dependents: [
      dependent('d1', 'p1', 'Rahim child 1', 'son'),
      dependent('d2', 'p1', 'Rahim child 2', 'daughter'),
    ],
  };
}

function dependent(id: string, personId: string, name: string, relation: Dependent['relation']): Dependent {
  return {
    id,
    person_id: personId,
    name,
    relation,
    occupation: 'Student',
    date_of_birth: null,
    age: null,
    gender: null,
    version: 1,
    created_at: NOW,
    updated_at: null,
  };
}

let store = fresh();

/** Back to the starting people (tests call this in beforeEach). */
export function resetWorkforceMocks() {
  store = fresh();
  resetProfileMocks();
  resetTeamMocks();
  resetContractorMocks();
}

const countOf = (personId: string) => store.dependents.filter((d) => d.person_id === personId).length;
const out = (p: Person): Person => ({ ...p, dependent_count: countOf(p.id) });
const refs = (ids: readonly string[], rows: Record<string, { code: string; name: string }>) =>
  ids.flatMap((id) => (rows[id] ? [{ id, ...rows[id] }] : []));
const SKILLS = { s1: { code: 'PLUCKING', name: 'Plucking' }, s2: { code: 'PRUNING', name: 'Pruning' } };
const LANGUAGES = { l1: { code: 'BN', name: 'Bangla' }, l2: { code: 'EN', name: 'English' } };

/** The person a body describes: ids turned into the named references the API returns. */
function fromBody(base: Person, body: Record<string, unknown>): Person {
  const next = { ...base, ...body } as Person & { skill_ids?: string[]; language_ids?: string[] };
  const skillIds = (body.skill_ids as string[] | undefined) ?? undefined;
  const languageIds = (body.language_ids as string[] | undefined) ?? undefined;
  if (skillIds) next.skills = refs(skillIds, SKILLS);
  if (languageIds) next.languages = refs(languageIds, LANGUAGES);
  const { skill_ids: _skills, language_ids: _languages, ...rest } = next;
  const person_ = rest;
  person_.full_name = [person_.first_name, person_.middle_name, person_.last_name].filter(Boolean).join(' ');
  return person_;
}

export function workforceMocks(b: string): RequestHandler[] {
  const find = (id: unknown) => store.persons.find((p) => p.id === id);
  const duplicate = (nationalId: unknown, except?: string) =>
    typeof nationalId === 'string' &&
    store.persons.some((p) => p.national_id === nationalId && p.id !== except);
  const dupError = () =>
    apiError(422, 'DUPLICATE_KEY', 'That national ID is already registered.', [
      { field: 'national_id', code: 'DUPLICATE', message: 'Another person has this national ID.' },
    ]);

  return [
    ...profileMocks(b),
    ...teamMocks(b),
    ...contractorMocks(b),
    http.get(`${b}/persons`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      const q = url.searchParams.get('filter[q]')?.toLowerCase();
      let rows = store.persons.map(out);
      if (q)
        rows = rows.filter(
          (p) =>
            p.full_name.toLowerCase().includes(q) ||
            p.person_code.toLowerCase().includes(q) ||
            (p.national_id ?? '').includes(q) ||
            (p.phone ?? '').includes(q),
        );
      for (const key of ['status', 'gender', 'registered_estate_id'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((p) => p[key] === wanted);
      }
      const sort = url.searchParams.get('sort') ?? 'full_name';
      const key = sort.replace(/^-/, '');
      const text = (p: Person) => {
        const value = (p as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : '';
      };
      rows.sort((x, y) => text(x).localeCompare(text(y)) * (sort.startsWith('-') ? -1 : 1));
      return page(request, rows);
    }),
    http.post(`${b}/persons`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.first_name !== 'string' || body.first_name.trim() === '')
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'first_name', code: 'REQUIRED', message: 'First name is required.' },
        ]);
      if (duplicate(body.national_id)) return dupError();
      store.sequence += 1;
      const id = `p${String(store.sequence)}`;
      const made = fromBody(person(id, { first_name: body.first_name }), body);
      store.persons.push(made);
      return created(out(made), `${b}/persons/${id}`, made.version);
    }),
    http.get(`${b}/persons/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      return found
        ? ok(out(found), { version: found.version })
        : apiError(404, 'NOT_FOUND', 'No such person.');
    }),
    http.put(`${b}/persons/:id`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return apiError(404, 'NOT_FOUND', 'No such person.');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as Record<string, unknown>;
      if (duplicate(body.national_id, found.id)) return dupError();
      const next = fromBody(found, body);
      next.version = found.version + 1;
      next.updated_at = NOW;
      store.persons = store.persons.map((p) => (p.id === found.id ? next : p));
      return ok(out(next), { version: next.version });
    }),
    ...(['deactivate', 'reactivate'] as const).map((action) =>
      http.post(`${b}/persons/:id/${action}`, ({ request, params }) => {
        const found = find(params.id);
        if (!found) return apiError(404, 'NOT_FOUND', 'No such person.');
        const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
        if (refused) return refused;
        const next: Person = {
          ...found,
          status: action === 'deactivate' ? 'inactive' : 'active',
          version: found.version + 1,
        };
        store.persons = store.persons.map((p) => (p.id === found.id ? next : p));
        return ok(out(next), { version: next.version });
      }),
    ),
    http.delete(`${b}/persons/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      if (params.id === 'p_ref')
        return apiError(
          422,
          'REFERENCED_RECORD',
          'This person has an employment profile. Deactivate them instead.',
        );
      store.persons = store.persons.filter((p) => p.id !== params.id);
      store.dependents = store.dependents.filter((d) => d.person_id !== params.id);
      return noContent();
    }),

    // ---- Dependents ----
    http.get(`${b}/persons/:id/dependents`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return ok(store.dependents.filter((d) => d.person_id === params.id));
    }),
    http.post(`${b}/persons/:id/dependents`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Dependent> & { name?: string };
      if (!body.name || body.name.trim() === '')
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'name', code: 'REQUIRED', message: 'Name is required.' },
        ]);
      store.sequence += 1;
      const made: Dependent = {
        ...dependent(`d${String(store.sequence)}`, String(params.id), body.name, body.relation ?? 'other'),
        occupation: body.occupation ?? null,
        date_of_birth: body.date_of_birth ?? null,
        gender: body.gender ?? null,
      };
      store.dependents.push(made);
      return created(made, `${b}/persons/${String(params.id)}/dependents/${made.id}`, made.version);
    }),
    http.patch(`${b}/persons/:id/dependents/:dependentId`, async ({ request, params }) => {
      const found = store.dependents.find((d) => d.id === params.dependentId);
      if (!found) return apiError(404, 'NOT_FOUND', 'No such family member.');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Dependent>;
      const next: Dependent = { ...found, ...body, version: found.version + 1 };
      store.dependents = store.dependents.map((d) => (d.id === found.id ? next : d));
      return ok(next, { version: next.version });
    }),
    http.delete(`${b}/persons/:id/dependents/:dependentId`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      store.dependents = store.dependents.filter((d) => d.id !== params.dependentId);
      return noContent();
    }),
  ];
}

export const handlers = workforceMocks('/api/v1');
