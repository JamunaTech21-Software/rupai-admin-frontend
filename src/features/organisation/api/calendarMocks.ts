import { http, HttpResponse, type RequestHandler } from 'msw';

import {
  apiError,
  created,
  noContent,
  ok,
  queryList,
  requireAuth,
  requireIfMatch,
} from '@/lib/mocking/contract';

import { type AccountingPeriod, type FiscalYear, type Season } from './schemas';

/**
 * In-memory calendars (P1.09) for VITE_MOCK_API=organisation and for tests. They follow the backend rules the
 * screens depend on: seasons of one estate never overlap, a planned season is activated and an active one closed,
 * only a planned season is deleted; a fiscal year is created from its start year, gets 13 periods once, and its
 * periods open in order; a fiscal year that has been opened cannot be deleted.
 */

const NOW = '2026-01-01T04:00:00.000Z';

interface CalendarStore {
  seasons: Season[];
  years: FiscalYear[];
  periods: AccountingPeriod[];
  sequence: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const iso = (date: Date) => date.toISOString().slice(0, 10);
/** The first day of a month counted from January of `year` (month 0-based, may run past 11). */
const firstOf = (year: number, month: number) => new Date(Date.UTC(year, month, 1));
const lastOf = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0));

function yearDates(startYear: number, startMonth: number) {
  return {
    start_date: iso(firstOf(startYear, startMonth - 1)),
    end_date: iso(lastOf(startYear, startMonth + 10)),
  };
}

function periodsOf(year: FiscalYear, openCount: number): AccountingPeriod[] {
  const start = new Date(`${year.start_date}T00:00:00Z`);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const blank = {
    fiscal_year_id: year.id,
    closed_at: null,
    closed_by: null,
    reopened_at: null,
    reopened_by: null,
    reopen_reason: null,
    version: 1,
    updated_at: null,
  };
  const monthly = Array.from({ length: 12 }, (_, i): AccountingPeriod => {
    const first = firstOf(y, m + i);
    return {
      ...blank,
      id: `${year.id}_p${String(i + 1)}`,
      period_number: i + 1,
      name: `${MONTHS[first.getUTCMonth()] ?? ''} ${String(first.getUTCFullYear())}`,
      start_date: iso(first),
      end_date: iso(lastOf(y, m + i)),
      state: i < openCount ? 'open' : 'future',
      is_adjustment: false,
    };
  });
  return [
    ...monthly,
    {
      ...blank,
      id: `${year.id}_p13`,
      period_number: 13,
      name: 'Year-end adjustments',
      start_date: year.end_date,
      end_date: year.end_date,
      state: 'future',
      is_adjustment: true,
    },
  ];
}

function seed(): CalendarStore {
  const season = (
    id: string,
    estate_id: string,
    code: string,
    start_date: string,
    end_date: string,
    state: Season['state'],
  ): Season => ({
    id,
    estate_id,
    code,
    name: `Season ${code}`,
    start_date,
    end_date,
    state,
    closed_at: state === 'closed' ? NOW : null,
    closed_by: state === 'closed' ? '1' : null,
    version: 1,
    created_at: NOW,
    updated_at: null,
  });
  const year: FiscalYear = {
    id: 'fy1',
    code: 'FY2026-27',
    name: 'Fiscal year 2026-27',
    ...yearDates(2026, 7),
    state: 'open',
    period_count: 13,
    closed_at: null,
    closed_by: null,
    version: 1,
    created_at: NOW,
    updated_at: null,
  };
  return {
    seasons: [
      season('se1', 'e1', '2025-26', '2025-03-01', '2026-02-28', 'closed'),
      season('se2', 'e1', '2026-27', '2026-03-01', '2027-02-28', 'active'),
      season('se3', 'e2', '2026-27', '2026-03-01', '2027-02-28', 'planned'),
      season('se4', 'e2', '2025-26', '2025-03-01', '2026-02-28', 'closed'),
    ],
    years: [year],
    periods: periodsOf(year, 4),
    sequence: 0,
  };
}

let store = seed();

/** Back to the seeded calendars (between tests). */
export function resetCalendarMocks(): void {
  store = seed();
}

/** The organisation's fiscal year start month is fixed once a fiscal year exists. */
export const mockHasFiscalYears = () => store.years.length > 0;

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const invalid = (field: string, message: string, context?: Record<string, unknown>) =>
  apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
    { field, code: 'VALIDATION_FAILED', message, ...(context ? { context } : {}) },
  ]);
const refused = (code: string, message: string) => apiError(422, code, message, [{ code, message }]);
const touch = <T extends { version: number; updated_at: string | null }>(row: T): T => {
  row.version += 1;
  row.updated_at = new Date().toISOString();
  return row;
};
const nextId = (prefix: string) => {
  store.sequence += 1;
  return `${prefix}_new_${String(store.sequence)}`;
};

function page(request: Request, rows: readonly Record<string, unknown>[], scoped = false) {
  const url = new URL(request.url);
  const perPage = Math.min(
    Math.max(Number.parseInt(url.searchParams.get('per_page') ?? '25', 10) || 25, 1),
    200,
  );
  const filtered = queryList(rows, request);
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(
    Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1),
    lastPage,
  );
  return HttpResponse.json(
    {
      data: filtered.slice((current - 1) * perPage, current * perPage),
      meta: {
        request_id: 'mock',
        pagination: { page: current, per_page: perPage, total: filtered.length, last_page: lastPage },
        ...(scoped ? { applied_scope: { all_estates: true, estates: [], divisions: [], sections: [] } } : {}),
      },
    },
    { headers: { 'X-Environment': 'mock' } },
  );
}

/** The other season of the estate these dates run into, if any. */
function overlap(estateId: string, start: string, end: string, exceptId?: string) {
  return store.seasons.find(
    (s) => s.estate_id === estateId && s.id !== exceptId && s.start_date <= end && s.end_date >= start,
  );
}
const overlapError = (other: Season) =>
  invalid('start_date', `overlaps season ${other.code} (${other.start_date} to ${other.end_date})`, {
    season_id: other.id,
    code: other.code,
  });

export function calendarMocks(b: string, startMonth: () => number): RequestHandler[] {
  const season = (id: unknown) => store.seasons.find((s) => s.id === id);
  const year = (id: unknown) => store.years.find((y) => y.id === id);
  const period = (id: unknown) => store.periods.find((p) => p.id === id);

  return [
    // ---- Seasons ----
    http.get(`${b}/seasons`, ({ request }) => requireAuth(request) ?? page(request, store.seasons, true)),
    http.post(`${b}/seasons`, async ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const body = (await request.json()) as Pick<
        Season,
        'estate_id' | 'code' | 'name' | 'start_date' | 'end_date'
      >;
      if (body.end_date <= body.start_date) return invalid('end_date', 'must be after start_date');
      if (store.seasons.some((s) => s.estate_id === body.estate_id && s.code === body.code)) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'code',
            code: 'DUPLICATE_KEY',
            message: 'This estate already has a season with this code.',
          },
        ]);
      }
      const other = overlap(body.estate_id, body.start_date, body.end_date);
      if (other) return overlapError(other);
      const row: Season = {
        ...body,
        id: nextId('se'),
        state: 'planned',
        closed_at: null,
        closed_by: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      store.seasons.push(row);
      return created(row, `${b}/seasons/${row.id}`, 1);
    }),
    http.get(`${b}/seasons/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = season(params.id);
      return row ? ok(row, { version: row.version }) : notFound();
    }),
    http.put(`${b}/seasons/:id`, async ({ request, params }) => {
      const row = season(params.id);
      if (!row) return notFound();
      const denied = requireAuth(request) ?? requireIfMatch(request, row.version);
      if (denied) return denied;
      if (row.state === 'closed') return refused('INVALID_TRANSITION', 'A closed season cannot be changed.');
      const body = (await request.json()) as Pick<Season, 'code' | 'name' | 'start_date' | 'end_date'>;
      if (row.state === 'active' && (body.code !== row.code || body.start_date !== row.start_date)) {
        return invalid(
          body.code !== row.code ? 'code' : 'start_date',
          'cannot be changed once the season is active',
        );
      }
      if (body.end_date <= body.start_date) return invalid('end_date', 'must be after start_date');
      const other = overlap(row.estate_id, body.start_date, body.end_date, row.id);
      if (other) return overlapError(other);
      Object.assign(row, body);
      return ok(touch(row), { version: row.version });
    }),
    http.delete(`${b}/seasons/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = season(params.id);
      if (!row) return notFound();
      if (row.state !== 'planned') {
        return refused('INVALID_TRANSITION', 'Only a planned season can be deleted.');
      }
      store.seasons = store.seasons.filter((s) => s.id !== row.id);
      return noContent();
    }),
    ...(['activate', 'close'] as const).map((action) =>
      http.post(`${b}/seasons/:id/${action}`, ({ request, params }) => {
        const row = season(params.id);
        if (!row) return notFound();
        const denied = requireAuth(request) ?? requireIfMatch(request, row.version);
        if (denied) return denied;
        const from = action === 'activate' ? 'planned' : 'active';
        if (row.state !== from) {
          return refused('INVALID_TRANSITION', `Only a ${from} season can be ${action}d.`);
        }
        row.state = action === 'activate' ? 'active' : 'closed';
        if (action === 'close') {
          row.closed_at = new Date().toISOString();
          row.closed_by = '1';
        }
        return ok(touch(row), { version: row.version });
      }),
    ),

    // ---- Fiscal years ----
    http.get(`${b}/fiscal-years`, ({ request }) => requireAuth(request) ?? page(request, store.years)),
    http.post(`${b}/fiscal-years`, async ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const body = (await request.json()) as { start_year: number };
      const dates = yearDates(body.start_year, startMonth());
      const other = store.years.find((y) => y.start_date <= dates.end_date && y.end_date >= dates.start_date);
      if (other) {
        return invalid(
          'start_year',
          `overlaps fiscal year ${other.code} (${other.start_date} to ${other.end_date})`,
          { fiscal_year_id: other.id, code: other.code },
        );
      }
      const label =
        startMonth() === 1
          ? String(body.start_year)
          : `${String(body.start_year)}-${String((body.start_year + 1) % 100).padStart(2, '0')}`;
      const row: FiscalYear = {
        id: nextId('fy'),
        code: `FY${label}`,
        name: `Fiscal year ${label}`,
        ...dates,
        state: 'future',
        period_count: 0,
        closed_at: null,
        closed_by: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      store.years.push(row);
      return created(row, `${b}/fiscal-years/${row.id}`, 1);
    }),
    http.get(`${b}/fiscal-years/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = year(params.id);
      return row ? ok(row, { version: row.version }) : notFound();
    }),
    http.put(`${b}/fiscal-years/:id`, async ({ request, params }) => {
      const row = year(params.id);
      if (!row) return notFound();
      const denied = requireAuth(request) ?? requireIfMatch(request, row.version);
      if (denied) return denied;
      const body = (await request.json()) as { code: string; name: string };
      if (store.years.some((y) => y.id !== row.id && y.code === body.code)) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'code', code: 'DUPLICATE_KEY', message: 'Another fiscal year has this code.' },
        ]);
      }
      Object.assign(row, body);
      return ok(touch(row), { version: row.version });
    }),
    http.delete(`${b}/fiscal-years/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = year(params.id);
      if (!row) return notFound();
      if (row.state !== 'future') {
        return refused('INVARIANT_VIOLATED', 'A fiscal year that has been opened cannot be deleted.');
      }
      store.years = store.years.filter((y) => y.id !== row.id);
      store.periods = store.periods.filter((p) => p.fiscal_year_id !== row.id);
      return noContent();
    }),
    http.post(`${b}/fiscal-years/:id/generate-periods`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = year(params.id);
      if (!row) return notFound();
      if (row.period_count > 0) {
        return refused('INVARIANT_VIOLATED', 'The periods of this fiscal year have already been generated.');
      }
      const generated = periodsOf(row, 0);
      store.periods.push(...generated);
      row.period_count = generated.length;
      return ok(generated);
    }),

    // ---- Accounting periods ----
    http.get(
      `${b}/accounting-periods`,
      ({ request }) => requireAuth(request) ?? page(request, store.periods),
    ),
    http.get(`${b}/accounting-periods/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = period(params.id);
      return row ? ok(row, { version: row.version }) : notFound();
    }),
    http.post(`${b}/accounting-periods/:id/open`, ({ request, params }) => {
      const row = period(params.id);
      if (!row) return notFound();
      const denied = requireAuth(request) ?? requireIfMatch(request, row.version);
      if (denied) return denied;
      if (row.state !== 'future') return refused('INVALID_TRANSITION', 'Only a future period can be opened.');
      const earlier = store.periods.find(
        (p) =>
          p.fiscal_year_id === row.fiscal_year_id &&
          p.period_number < row.period_number &&
          p.state === 'future',
      );
      if (earlier) {
        return refused(
          'INVARIANT_VIOLATED',
          `Open period ${String(earlier.period_number)} (${earlier.name}) first.`,
        );
      }
      row.state = 'open';
      const owner = year(row.fiscal_year_id);
      if (owner?.state === 'future') {
        owner.state = 'open';
        touch(owner);
      }
      return ok(touch(row), { version: row.version });
    }),
  ];
}
