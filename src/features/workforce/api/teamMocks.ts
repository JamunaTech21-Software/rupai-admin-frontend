import { http, type RequestHandler } from 'msw';

import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import { type Member, type Team } from './teams';

/**
 * MSW mocks of worker teams and their membership (P2.04): the same addresses, bodies, `If-Match` rule and refusals as
 * the backend (422 DUPLICATE_KEY on a code, or on a worker still in another team with that team named in the detail's
 * context; 422 REFERENCED_RECORD on deleting a team that had members; 409 on deactivating a team with members).
 */

const NOW = '2026-01-01T04:00:00.000Z';
const TODAY = '2026-10-25';
const ESTATE = { id: 'e1', code: 'DEMO-A', name: 'Rupai Hills Tea Estate' };

const WORKERS: Record<string, { profile_number: string; full_name: string }> = {
  pr2: { profile_number: 'WRK-A-0001', full_name: 'Salma Begum' },
  pr3: { profile_number: 'WRK-A-0002', full_name: 'Jalal Mia' },
  pr9: { profile_number: 'WRK-A-0009', full_name: 'Karim Ali' },
};

function team(id: string, fields: Partial<Team> & Pick<Team, 'code' | 'name' | 'team_type'>): Team {
  return {
    id,
    estate_id: ESTATE.id,
    estate: ESTATE,
    supervisor_profile_id: null,
    supervisor: null,
    division_id: null,
    division: null,
    section_id: null,
    section: null,
    description: null,
    member_count: 0,
    leader: null,
    status: 'active',
    version: 1,
    created_at: NOW,
    updated_at: null,
    ...fields,
  };
}

function member(
  id: string,
  teamId: string,
  profileId: string,
  fields: Partial<Member> & Pick<Member, 'effective_from'>,
): Member {
  const code = teamId === 't1' ? 'PG-NORTH' : 'FT-SOUTH';
  const worker = WORKERS[profileId] ?? { profile_number: profileId, full_name: profileId };
  return {
    id,
    worker_team_id: teamId,
    team: { id: teamId, code, name: teamId === 't1' ? 'Plucking Gang North' : 'Field Team South' },
    employment_profile_id: profileId,
    profile: { id: profileId, ...worker, status: 'active' },
    effective_to: null,
    role_in_team: 'member',
    is_current: true,
    version: 1,
    ...fields,
  };
}

interface Store {
  teams: Team[];
  members: Member[];
  sequence: number;
}

function fresh(): Store {
  return {
    sequence: 100,
    teams: [
      team('t1', { code: 'PG-NORTH', name: 'Plucking Gang North', team_type: 'plucking' }),
      team('t2', { code: 'FT-SOUTH', name: 'Field Team South', team_type: 'field' }),
      team('t3', { code: 'EMPTY', name: 'Empty Team', team_type: 'general' }),
    ],
    members: [
      member('m1', 't1', 'pr2', { effective_from: '2020-01-01', role_in_team: 'leader' }),
      member('m2', 't2', 'pr3', { effective_from: '2026-10-01' }),
    ],
  };
}

let store = fresh();

/** Back to the starting teams (tests call this in beforeEach). */
export function resetTeamMocks() {
  store = fresh();
}

/** Whether a membership covers a date. */
const covers = (m: Member, date: string) =>
  m.effective_from <= date && (m.effective_to === null || m.effective_to >= date);
const withCurrent = (m: Member, date = TODAY): Member => ({ ...m, is_current: covers(m, date) });

/** A team with its members today and its leader. */
function teamOut(t: Team): Team {
  const today = store.members.filter((m) => m.worker_team_id === t.id && covers(m, TODAY));
  const leader = today.find((m) => m.role_in_team === 'leader');
  return {
    ...t,
    member_count: today.length,
    leader: leader
      ? {
          profile_id: leader.employment_profile_id,
          profile_number: leader.profile.profile_number,
          full_name: leader.profile.full_name,
        }
      : null,
  };
}

const dayBefore = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function teamMocks(b: string): RequestHandler[] {
  const find = (id: unknown) => store.teams.find((t) => t.id === id);
  const replaceTeam = (next: Team) => {
    store.teams = store.teams.map((t) => (t.id === next.id ? next : t));
    return next;
  };
  const findMember = (id: unknown) => store.members.find((m) => m.id === id);
  const replaceMember = (next: Member) => {
    store.members = store.members.map((m) => (m.id === next.id ? next : m));
    return next;
  };

  return [
    http.get(`${b}/worker-teams`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      let rows = store.teams.map(teamOut);
      for (const key of ['estate_id', 'team_type', 'status', 'section_id'] as const) {
        const wanted = url.searchParams.get(`filter[${key}]`);
        if (wanted) rows = rows.filter((t) => t[key] === wanted);
      }
      const q = url.searchParams.get('filter[q]')?.toLowerCase();
      if (q) rows = rows.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
      const sort = url.searchParams.get('sort') ?? 'code';
      const key = sort.replace(/^-/, '');
      const text = (t: Team) => {
        const value = (t as Record<string, unknown>)[key];
        return typeof value === 'string' ? value : '';
      };
      rows.sort((x, y) => text(x).localeCompare(text(y)) * (sort.startsWith('-') ? -1 : 1));
      return page(request, rows);
    }),
    http.post(`${b}/worker-teams`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Team> & { estate_id?: string };
      if (store.teams.some((t) => t.code === body.code && t.estate_id === body.estate_id))
        return apiError(422, 'DUPLICATE_KEY', 'That code is already used in this estate.', [
          { field: 'code', code: 'DUPLICATE_KEY', message: 'Another team of this estate has this code.' },
        ]);
      store.sequence += 1;
      const made = team(`t${String(store.sequence)}`, {
        code: body.code ?? '',
        name: body.name ?? '',
        team_type: body.team_type ?? 'general',
        ...(body.description !== undefined ? { description: body.description } : {}),
      });
      store.teams.push(made);
      return created(teamOut(made), `${b}/worker-teams/${made.id}`, made.version);
    }),
    http.get(`${b}/worker-teams/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const found = find(params.id);
      return found
        ? ok(teamOut(found), { version: found.version })
        : apiError(404, 'NOT_FOUND', 'No such team.');
    }),
    http.put(`${b}/worker-teams/:id`, async ({ request, params }) => {
      const found = find(params.id);
      if (!found) return apiError(404, 'NOT_FOUND', 'No such team.');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Team>;
      const next = replaceTeam({ ...found, ...body, version: found.version + 1, updated_at: NOW });
      return ok(teamOut(next), { version: next.version });
    }),
    ...(['deactivate', 'reactivate'] as const).map((action) =>
      http.post(`${b}/worker-teams/:id/${action}`, ({ request, params }) => {
        const found = find(params.id);
        if (!found) return apiError(404, 'NOT_FOUND', 'No such team.');
        const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
        if (refused) return refused;
        if (action === 'deactivate' && teamOut(found).member_count > 0)
          return apiError(409, 'CONFLICT', 'End the memberships first: the team still has members today.');
        const next = replaceTeam({
          ...found,
          status: action === 'deactivate' ? 'inactive' : 'active',
          version: found.version + 1,
        });
        return ok(teamOut(next), { version: next.version });
      }),
    ),
    http.delete(`${b}/worker-teams/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      if (store.members.some((m) => m.worker_team_id === params.id))
        return apiError(422, 'REFERENCED_RECORD', 'This team has had members. Deactivate it instead.');
      store.teams = store.teams.filter((t) => t.id !== params.id);
      return noContent();
    }),

    // ---- Members ----
    http.get(`${b}/worker-teams/:id/members`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const url = new URL(request.url);
      const mine = store.members.filter((m) => m.worker_team_id === params.id);
      if (url.searchParams.get('history') === 'true')
        return ok(
          mine.map((m) => withCurrent(m)).sort((x, y) => y.effective_from.localeCompare(x.effective_from)),
        );
      const date = url.searchParams.get('as_of') ?? TODAY;
      const rank = { leader: 0, assistant: 1, member: 2 } as const;
      return ok(
        mine
          .filter((m) => covers(m, date))
          .map((m) => withCurrent(m, date))
          .sort((x, y) => rank[x.role_in_team] - rank[y.role_in_team]),
      );
    }),
    http.post(`${b}/worker-teams/:id/members`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as {
        members: {
          employment_profile_id: string;
          effective_from: string;
          role_in_team: Member['role_in_team'];
        }[];
        move_from_other_team: boolean;
      };
      const teamId = String(params.id);
      const elsewhere = body.members.flatMap((m) => {
        const other = store.members.find(
          (x) =>
            x.employment_profile_id === m.employment_profile_id &&
            x.worker_team_id !== teamId &&
            covers(x, TODAY),
        );
        return other ? [{ new: m, other }] : [];
      });
      if (elsewhere.length > 0 && !body.move_from_other_team)
        return apiError(
          422,
          'DUPLICATE_KEY',
          'A worker is still in another team.',
          elsewhere.map(({ new: m, other }) => ({
            field: 'members',
            code: 'DUPLICATE_KEY',
            message: `${other.profile.full_name} is in ${other.team.name}.`,
            context: { worker_team_id: other.worker_team_id, employment_profile_id: m.employment_profile_id },
          })),
        );
      for (const { new: m, other } of elsewhere)
        replaceMember({ ...other, effective_to: dayBefore(m.effective_from), is_current: false });
      const made = body.members.map((m) => {
        store.sequence += 1;
        return member(`m${String(store.sequence)}`, teamId, m.employment_profile_id, {
          effective_from: m.effective_from,
          role_in_team: m.role_in_team,
        });
      });
      store.members.push(...made);
      return created(
        made.map((m) => withCurrent(m)),
        `${b}/worker-teams/${teamId}/members`,
      );
    }),
    http.post(`${b}/worker-teams/:id/members/:memberId/end`, async ({ request, params }) => {
      const found = findMember(params.memberId);
      if (!found) return apiError(404, 'NOT_FOUND', 'No such membership.');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { effective_to: string };
      if (body.effective_to < found.effective_from)
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'effective_to',
            code: 'BEFORE_START',
            message: 'The last day cannot be before the first day.',
          },
        ]);
      const next = replaceMember({ ...found, effective_to: body.effective_to, version: found.version + 1 });
      return ok(withCurrent(next), { version: next.version });
    }),
    http.patch(`${b}/worker-teams/:id/members/:memberId`, async ({ request, params }) => {
      const found = findMember(params.memberId);
      if (!found) return apiError(404, 'NOT_FOUND', 'No such membership.');
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { role_in_team: Member['role_in_team'] };
      if (
        body.role_in_team === 'leader' &&
        store.members.some(
          (m) =>
            m.worker_team_id === found.worker_team_id &&
            m.id !== found.id &&
            m.role_in_team === 'leader' &&
            covers(m, TODAY),
        )
      )
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'role_in_team', code: 'ONE_LEADER', message: 'The team already has a leader.' },
        ]);
      const next = replaceMember({ ...found, role_in_team: body.role_in_team, version: found.version + 1 });
      return ok(withCurrent(next), { version: next.version });
    }),
    http.delete(`${b}/worker-teams/:id/members/:memberId`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      store.members = store.members.filter((m) => m.id !== params.memberId);
      return noContent();
    }),
    http.get(`${b}/employment-profiles/:id/teams`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return ok(
        store.members
          .filter((m) => m.employment_profile_id === params.id)
          .map((m) => withCurrent(m))
          .sort((x, y) => y.effective_from.localeCompare(x.effective_from)),
      );
    }),
  ];
}
