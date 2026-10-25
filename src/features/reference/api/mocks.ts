import { http, type RequestHandler } from 'msw';

import {
  apiError,
  created,
  noContent,
  ok,
  page,
  queryList,
  requireAuth,
  requireIfMatch,
} from '@/lib/mocking/contract';
import { type LookupType } from '@/lib/lookups';

import { MASTER_TYPES, type MasterType } from '../masters';

/**
 * In-memory reference masters (P1.10) for VITE_MOCK_API=reference and for tests. Every type gets the same
 * handlers from its descriptor, with the backend rules the screens depend on: a unique key per type, If-Match
 * on every change, system records that keep their key and are never retired (SYSTEM_RECORD), a row in use that
 * cannot be deleted (REFERENCED_RECORD), and the base unit of a category chosen on the category.
 */

const NOW = '2026-01-01T04:00:00.000Z';

type Row = Record<string, unknown> & { id: string; status: 'active' | 'inactive'; version: number };
type Store = Record<LookupType, Row[]>;

function seed(): Store {
  const row = (id: string, fields: Record<string, unknown>): Row => ({
    id,
    ...fields,
    status: 'active',
    version: 1,
    created_at: NOW,
    updated_at: null,
  });
  const plain = (id: string, code: string, name: string, sort_order = 10, is_system = false) =>
    row(id, { code, name, description: null, sort_order, is_system });
  const empty = Object.fromEntries(MASTER_TYPES.map((type) => [type.key, [] as Row[]])) as Store;
  return {
    ...empty,
    department: [
      plain('dep1', 'FIELD', 'Field', 10),
      plain('dep2', 'FACTORY', 'Factory', 20),
      { ...plain('dep3', 'STORES', 'Stores', 30), status: 'inactive' },
    ],
    designation: [plain('des1', 'MANAGER', 'Manager'), plain('des2', 'CLERK', 'Clerk', 20)],
    worker_category: [plain('wc1', 'PERMANENT', 'Permanent worker', 10, true)],
    religion: [plain('r1', 'ISLAM', 'Islam', 10), plain('r2', 'HINDUISM', 'Hinduism', 20)],
    education_level: [plain('e1', 'PRIMARY', 'Primary', 10), plain('e2', 'SECONDARY', 'Secondary', 20)],
    skill: [plain('s1', 'PLUCKING', 'Plucking', 10), plain('s2', 'PRUNING', 'Pruning', 20)],
    language: [plain('l1', 'BN', 'Bangla', 10), plain('l2', 'EN', 'English', 20)],
    employee_category: [plain('ec1', 'OFFICER', 'Officer', 10)],
    job_grade: [plain('jg1', 'GRADE_1', 'Grade 1', 10), plain('jg2', 'GRADE_2', 'Grade 2', 20)],
    tea_type: [
      { ...plain('tt1', 'CTC', 'CTC', 10), manufacture_process: 'ctc' },
      { ...plain('tt2', 'ORTHODOX', 'Orthodox', 20), manufacture_process: 'orthodox' },
      { ...plain('tt3', 'GREEN', 'Green tea', 30), manufacture_process: 'green' },
    ],
    tea_grade: [
      {
        ...plain('tg1', 'BOP', 'Broken Orange Pekoe', 10),
        tea_type_id: null,
        grade_category: 'broken',
        is_primary_grade: false,
      },
      {
        ...plain('tg2', 'PD', 'Pekoe Dust', 20),
        tea_type_id: 'tt1',
        grade_category: 'dust',
        is_primary_grade: true,
      },
      {
        ...plain('tg3', 'OP', 'Orange Pekoe', 30),
        tea_type_id: 'tt2',
        grade_category: 'leaf',
        is_primary_grade: true,
      },
    ],
    activity_type: [
      {
        ...plain('at1', 'PRUNING', 'Pruning', 10),
        cost_category: 'cultivation',
        default_uom_id: null,
        requires_material: false,
      },
    ],
    shift: [
      {
        ...plain('sh1', 'DAY', 'Day shift', 0),
        estate_id: null,
        start_time: '06:00',
        end_time: '14:00',
        break_minutes: 30,
        grace_minutes: 10,
        half_day_hours: null,
        is_overnight: false,
        overtime_after_minutes: null,
      },
      {
        ...plain('sh2', 'NIGHT', 'Night shift', 0),
        estate_id: 'e1',
        start_time: '22:00',
        end_time: '06:00',
        break_minutes: 30,
        grace_minutes: 10,
        half_day_hours: '4.0000',
        is_overnight: true,
        overtime_after_minutes: 480,
      },
    ],
    uom_category: [
      { ...plain('uc1', 'WEIGHT', 'Weight', 10, true), base_uom_id: 'u1' },
      { ...plain('uc2', 'VOLUME', 'Volume', 20, true), base_uom_id: null },
      { ...plain('uc3', 'COUNT', 'Count', 30), base_uom_id: null },
    ],
    uom: [
      row('u1', {
        uom_category_id: 'uc1',
        code: 'kg',
        name: 'Kilogram',
        decimal_precision: 3,
        conversion_factor: '1.0000',
        is_base: true,
        is_system: true,
      }),
      row('u2', {
        uom_category_id: 'uc1',
        code: 'ton',
        name: 'Tonne',
        decimal_precision: 3,
        conversion_factor: '1000.0000',
        is_base: false,
        is_system: false,
      }),
      row('u3', {
        uom_category_id: 'uc2',
        code: 'l',
        name: 'Litre',
        decimal_precision: 2,
        conversion_factor: null,
        is_base: false,
        is_system: false,
      }),
      row('u4', {
        uom_category_id: 'uc2',
        code: 'ml',
        name: 'Millilitre',
        decimal_precision: 0,
        conversion_factor: null,
        is_base: false,
        is_system: false,
      }),
    ],
    currency: [
      row('cur_bdt', {
        code: 'BDT',
        name: 'Bangladeshi taka',
        symbol: '৳',
        decimal_places: 2,
        is_base: true,
      }),
      row('cur_usd', { code: 'USD', name: 'US dollar', symbol: '$', decimal_places: 2, is_base: false }),
    ],
    country: [
      row('co_bd', { iso2: 'BD', iso3: 'BGD', name: 'Bangladesh', dialling_code: '+880' }),
      row('co_in', { iso2: 'IN', iso3: 'IND', name: 'India', dialling_code: '+91' }),
      row('co_gb', { iso2: 'GB', iso3: 'GBR', name: 'United Kingdom', dialling_code: '+44' }),
    ],
  };
}

let store = seed();
let sequence = 0;

/** Back to the seeded masters (between tests). */
export function resetReferenceMocks(): void {
  store = seed();
  sequence = 0;
}

/** What refers to a row, by the type that is referred to: [the referring type, its field]. */
const REFERRERS: Partial<Record<LookupType, readonly (readonly [LookupType, string])[]>> = {
  tea_type: [['tea_grade', 'tea_type_id']],
  uom_category: [['uom', 'uom_category_id']],
  uom: [
    ['activity_type', 'default_uom_id'],
    ['uom_category', 'base_uom_id'],
  ],
};

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const refused = (code: string, message: string, detail: string, field?: string) =>
  apiError(422, code, message, [{ ...(field ? { field } : {}), code, message: detail }]);
const invalid = (field: string, message: string) =>
  apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
    { field, code: 'VALIDATION_FAILED', message },
  ]);

/** Rows in the order the selection lists show them. */
function ordered(type: MasterType, rows: readonly Row[]): Row[] {
  const url = new Request(`http://mock/?sort=${type.defaultSort}`);
  return queryList(rows, url);
}

/** The list grammar, plus the tea grades' "valid for this tea type" filter (its own grades and universal ones). */
function list(request: Request, rows: readonly Row[]) {
  const url = new URL(request.url);
  const validFor = url.searchParams.get('filter[valid_for_tea_type_id]');
  url.searchParams.delete('filter[valid_for_tea_type_id]');
  const candidates = validFor
    ? rows.filter((row) => row.tea_type_id === null || row.tea_type_id === validFor)
    : rows;
  return page(request, queryList(candidates, new Request(url.toString())));
}

/** The writable fields of a body, with the server's defaults and derived values. */
function values(
  type: MasterType,
  body: Record<string, unknown>,
  current: Row | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of type.fields) {
    if (field.isReadOnly && field.name !== 'base_uom_id') continue;
    const given = body[field.name];
    if (given !== undefined) {
      out[field.name] =
        field.type.kind === 'text' && field.type.isUpper && typeof given === 'string'
          ? given.toUpperCase()
          : given;
    } else if (!current) {
      out[field.name] = field.fallback ?? (field.type.kind === 'bool' ? false : null);
    }
  }
  return out;
}

function typeHandlers(b: string, type: MasterType): RequestHandler[] {
  const path = `${b}${type.path}`;
  const rows = () => store[type.key];
  const find = (id: unknown) => rows().find((row) => row.id === id);
  const touch = (row: Row) => {
    row.version += 1;
    row.updated_at = new Date().toISOString();
    return row;
  };
  const isSystem = (row: Row) => type.hasSystem && row.is_system === true;
  const label = type.key.replaceAll('_', ' ');

  /** Why a row cannot be deactivated or deleted, if it cannot. */
  function retireRefusal(row: Row, what: string) {
    if (isSystem(row)) {
      return refused(
        'SYSTEM_RECORD',
        `This ${label} is a system record and cannot be ${what}.`,
        'The application depends on it. It may be renamed.',
      );
    }
    if (type.hasBase && row.is_base === true) {
      const message =
        type.key === 'uom'
          ? 'This is the base unit of its category; choose another base unit first.'
          : 'The base currency cannot be deactivated or deleted.';
      return refused('INVARIANT_VIOLATED', message, message);
    }
    return null;
  }

  async function change(request: Request, id: unknown) {
    const row = find(id);
    if (!row) return notFound();
    const denied = requireAuth(request) ?? requireIfMatch(request, row.version);
    if (denied) return denied;
    const next = values(type, (await request.json()) as Record<string, unknown>, row);
    const key = next[type.keyField];
    if (key !== undefined && key !== row[type.keyField]) {
      if (isSystem(row)) {
        return refused(
          'SYSTEM_RECORD',
          `The ${type.keyField} of a system ${label} cannot be changed.`,
          'The application refers to it. The name may be changed.',
          type.keyField,
        );
      }
      if (rows().some((other) => other.id !== row.id && other[type.keyField] === key)) {
        return refused(
          'DUPLICATE_KEY',
          `That ${label} ${type.keyField} is already in use.`,
          'is already in use',
          type.keyField,
        );
      }
    }
    if (
      type.key === 'uom_category' &&
      next.base_uom_id !== undefined &&
      next.base_uom_id !== row.base_uom_id
    ) {
      const units = store.uom.filter((unit) => unit.uom_category_id === row.id);
      const base = units.find((unit) => unit.id === next.base_uom_id);
      if (next.base_uom_id !== null && !base)
        return invalid('base_uom_id', 'must be a unit of this category');
      if (
        row.base_uom_id !== null &&
        units.some((unit) => !unit.is_base && unit.conversion_factor !== null)
      ) {
        const message =
          'Units of this category have conversion factors against the current base unit; clear them first.';
        return refused('INVARIANT_VIOLATED', message, message);
      }
      for (const unit of units) {
        if (unit.is_base) Object.assign(unit, { is_base: false, conversion_factor: null });
      }
      if (base) Object.assign(base, { is_base: true, conversion_factor: '1.0000' });
    }
    Object.assign(row, next);
    if (type.key === 'shift') row.is_overnight = String(row.end_time) <= String(row.start_time);
    return ok(touch(row), { version: row.version });
  }

  return [
    http.get(path, ({ request }) => requireAuth(request) ?? list(request, rows())),
    http.post(path, async ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const next = values(type, (await request.json()) as Record<string, unknown>, null);
      if (rows().some((other) => other[type.keyField] === next[type.keyField])) {
        return refused(
          'DUPLICATE_KEY',
          `That ${label} ${type.keyField} is already in use.`,
          'is already in use',
          type.keyField,
        );
      }
      if (type.key === 'uom_category' && next.base_uom_id !== null) {
        return invalid('base_uom_id', 'set the base unit after creating the units of the category');
      }
      sequence += 1;
      const row: Row = {
        ...next,
        ...(type.hasSystem ? { is_system: false } : {}),
        ...(type.hasBase ? { is_base: false } : {}),
        ...(type.key === 'shift' ? { is_overnight: String(next.end_time) <= String(next.start_time) } : {}),
        id: `${type.key}_new_${String(sequence)}`,
        status: 'active',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      rows().push(row);
      return created(row, `${path}/${row.id}`, 1);
    }),
    http.get(`${path}/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = find(params.id);
      return row ? ok(row, { version: row.version }) : notFound();
    }),
    http.put(`${path}/:id`, ({ request, params }) => change(request, params.id)),
    http.patch(`${path}/:id`, ({ request, params }) => change(request, params.id)),
    http.delete(`${path}/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const row = find(params.id);
      if (!row) return notFound();
      const refusal = retireRefusal(row, 'deleted');
      if (refusal) return refusal;
      const inUse = (REFERRERS[type.key] ?? []).some(([other, field]) =>
        store[other].some((candidate) => candidate[field] === row.id),
      );
      if (inUse) {
        return refused(
          'REFERENCED_RECORD',
          `This ${label} is in use, so it cannot be deleted.`,
          'Deactivate it instead.',
        );
      }
      store[type.key] = rows().filter((other) => other.id !== row.id);
      return noContent();
    }),
    ...(['deactivate', 'reactivate'] as const).map((action) =>
      http.post(`${path}/:id/${action}`, ({ request, params }) => {
        const row = find(params.id);
        if (!row) return notFound();
        const denied = requireAuth(request) ?? requireIfMatch(request, row.version);
        if (denied) return denied;
        const status = action === 'deactivate' ? 'inactive' : 'active';
        if (row.status === status) return ok(row, { version: row.version });
        if (status === 'inactive') {
          const refusal = retireRefusal(row, 'deactivated');
          if (refusal) return refusal;
        }
        row.status = status;
        return ok(touch(row), { version: row.version });
      }),
    ),
  ];
}

export function referenceMocks(b: string): RequestHandler[] {
  return [
    // Every ACTIVE row of every type (or of ?types=a,b), for the selection lists.
    http.get(`${b}/lookups`, ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const wanted = new URL(request.url).searchParams.get('types')?.split(',').filter(Boolean);
      const types = MASTER_TYPES.filter((type) => !wanted || wanted.includes(type.key));
      return ok(
        Object.fromEntries(
          types.map((type) => [
            type.key,
            ordered(
              type,
              store[type.key].filter((row) => row.status === 'active'),
            ),
          ]),
        ),
      );
    }),
    ...MASTER_TYPES.flatMap((type) => typeHandlers(b, type)),
  ];
}

export const handlers = referenceMocks('/api/v1');
