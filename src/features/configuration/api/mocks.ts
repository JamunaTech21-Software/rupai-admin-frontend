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

import { exampleNumber, SAMPLE } from '../numbering';
import { type NumberComponent, type NumberFormat, type ResetFrequency, type Separator } from './numbering';
import { type Setting, type SettingType } from './settings';

/**
 * In-memory numbering and settings (P1.11) for VITE_MOCK_API=configuration and for tests, with the backend
 * rules the screens rely on: If-Match on every change, a part the document cannot carry refused on its field,
 * typed setting values, a unique key, encrypted values never returned, and no encryption key → 422.
 */

const NOW = '2026-01-01T04:00:00.000Z';
const TODAY = '2026-10-14';

interface Store {
  formats: NumberFormat[];
  sequences: Record<string, { scope_key: string; last_number: string; updated_at: string }[]>;
  settings: (Setting & { secret: string | null })[];
  nextId: number;
  /** Whether the server has SETTINGS_ENCRYPTION_KEY. */
  canEncrypt: boolean;
}

function format(
  id: string,
  document_type: string,
  label: string,
  prefix: string,
  lifecycle: 'financial' | 'operational',
  available_components: NumberComponent[],
): NumberFormat {
  const financial = lifecycle === 'financial';
  const base = {
    id,
    document_type,
    label,
    lifecycle,
    available_components,
    prefix,
    include_estate_code: available_components.includes('estate'),
    include_fiscal_year: financial && available_components.includes('fiscal_year'),
    include_season: false,
    separator: '-',
    sequence_width: 5,
    reset_frequency: (financial ? 'never' : 'yearly') as ResetFrequency,
    is_gapless: financial,
    version: 1,
    updated_at: null,
  };
  return { ...base, example: render(base) };
}

type Parts = Pick<
  NumberFormat,
  | 'prefix'
  | 'separator'
  | 'sequence_width'
  | 'reset_frequency'
  | 'include_estate_code'
  | 'include_fiscal_year'
  | 'include_season'
>;

function render(f: Parts): string {
  return exampleNumber({ ...f, separator: f.separator as Separator }, TODAY);
}

function seed(): Store {
  return {
    formats: [
      format('nf1', 'goods_receipt', 'Goods receipt', 'GRN', 'operational', ['estate', 'fiscal_year']),
      format('nf2', 'journal', 'Journal', 'JV', 'financial', ['fiscal_year']),
      format('nf3', 'leaf_purchase', 'Leaf purchase', 'LP', 'financial', ['estate', 'fiscal_year', 'season']),
      format('nf4', 'production_batch', 'Production batch', 'PB', 'operational', ['fiscal_year', 'season']),
      format('nf5', 'purchase_order', 'Purchase order', 'PO', 'operational', ['estate', 'fiscal_year']),
      format('nf6', 'sale', 'Sale', 'INV', 'financial', ['fiscal_year']),
    ],
    sequences: {
      nf5: [
        { scope_key: `E:${SAMPLE.estate}|Y:2026`, last_number: '41', updated_at: '2026-10-12T05:30:00.000Z' },
        { scope_key: 'E:DEMO-B|Y:2026', last_number: '7', updated_at: '2026-10-10T05:30:00.000Z' },
      ],
    },
    settings: [
      setting(
        's1',
        'attendance.grace_minutes',
        'integer',
        10,
        'Minutes late before a worker is marked late.',
      ),
      setting('s2', 'attendance.half_day_hours', 'decimal', '4.50', null),
      setting('s3', 'notifications.sms_enabled', 'boolean', true, 'Send SMS when a payslip is ready.'),
      setting('s4', 'notifications.sender_name', 'string', 'RupAi Tea', null),
      {
        ...setting('s5', 'integration.sms_api_key', 'string', null, 'Key for the SMS gateway.'),
        is_encrypted: true,
        has_value: true,
        secret: 'abc',
      },
      setting('s6', 'payroll.rounding', 'json', { mode: 'nearest', to: '0.50' }, null),
    ],
    nextId: 100,
    canEncrypt: true,
  };
}

function setting(
  id: string,
  key: string,
  value_type: SettingType,
  value: unknown,
  description: string | null,
) {
  return {
    id,
    key,
    group: key.slice(0, key.indexOf('.')),
    value_type,
    is_encrypted: false,
    value,
    has_value: value !== null,
    description,
    version: 1,
    updated_at: null,
    updated_by: null,
    secret: null as string | null,
  };
}

let store = seed();

export function resetConfigurationMocks(options: { canEncrypt?: boolean } = {}): void {
  store = seed();
  store.canEncrypt = options.canEncrypt ?? true;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const invalid = (field: string, message: string) =>
  apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
    { field, code: 'VALIDATION_FAILED', message },
  ]);
const publicSetting = ({ secret: _secret, ...row }: Store['settings'][number]): Setting => ({
  ...row,
  value: row.is_encrypted ? null : row.value,
});

/** Whether a value fits a type (backend core/settings settingToText); the reason when it does not. */
function typeError(type: SettingType, value: unknown): string | null {
  if (value === null) return null;
  switch (type) {
    case 'string':
      return typeof value === 'string' ? null : 'must be a string of at most 10000 characters';
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value) ? null : 'must be a whole number';
    case 'decimal':
      return typeof value === 'string' && /^-?\d{1,30}(\.\d{1,10})?$/.test(value)
        ? null
        : 'must be a decimal string such as "12.50", not a number';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be true or false';
    case 'json':
      return null;
  }
}

const noKey = () =>
  apiError(422, 'INVARIANT_VIOLATED', 'Encrypted settings are not available on this server.', [
    { code: 'INVARIANT_VIOLATED', message: 'SETTINGS_ENCRYPTION_KEY is not configured.' },
  ]);

export function configurationMocks(base = '/api/v1'): RequestHandler[] {
  const findFormat = (id: unknown) => store.formats.find((f) => f.id === id);
  const findSetting = (id: unknown) => store.settings.find((s) => s.id === id);

  return [
    http.get(`${base}/number-formats`, ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const rows = queryList(store.formats, request);
      return page(request, rows);
    }),

    http.get(`${base}/number-formats/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const f = findFormat(params.id);
      return f ? ok(f, { version: f.version }) : notFound();
    }),

    http.patch(`${base}/number-formats/:id`, async ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const f = findFormat(params.id);
      if (!f) return notFound();
      const conflict = requireIfMatch(request, f.version);
      if (conflict) return conflict;
      const body = (await request.json()) as Partial<NumberFormat>;
      const wants: [NumberComponent, keyof NumberFormat][] = [
        ['estate', 'include_estate_code'],
        ['fiscal_year', 'include_fiscal_year'],
        ['season', 'include_season'],
      ];
      for (const [component, field] of wants) {
        if (body[field] === true && !f.available_components.includes(component))
          return invalid(field, `this document has no ${component.replace('_', ' ')}`);
      }
      const next = {
        ...f,
        ...body,
        prefix: (body.prefix ?? f.prefix).toUpperCase(),
        version: f.version + 1,
        updated_at: NOW,
      };
      const saved = { ...next, example: render(next) };
      store.formats = store.formats.map((x) => (x.id === f.id ? saved : x));
      return ok(saved, { version: saved.version });
    }),

    http.get(`${base}/number-formats/:id/preview`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const f = findFormat(params.id);
      if (!f) return notFound();
      return ok({ next_number: f.example, scope_key: '*', last_number: '0' });
    }),

    http.get(`${base}/number-formats/:id/sequences`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const f = findFormat(params.id);
      if (!f) return notFound();
      return page(request, store.sequences[f.id] ?? []);
    }),

    http.get(`${base}/settings`, ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const rows = [...store.settings].sort(
        (a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key),
      );
      return page(request, queryList(rows, request).map(publicSetting));
    }),

    http.post(`${base}/settings`, async ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const body = (await request.json()) as {
        key: string;
        value_type: SettingType;
        is_encrypted?: boolean;
        group?: string;
        value: unknown;
        description?: string | null;
      };
      if (store.settings.some((s) => s.key === body.key))
        return apiError(422, 'DUPLICATE_KEY', `Setting ${body.key} already exists.`, [
          { field: 'key', code: 'DUPLICATE_KEY', message: 'is already in use' },
        ]);
      const problem = typeError(body.value_type, body.value ?? null);
      if (problem) return invalid('value', problem);
      const encrypted = body.is_encrypted ?? false;
      if (encrypted && body.value !== null && !store.canEncrypt) return noKey();
      store.nextId += 1;
      const row = {
        ...setting(
          `s${String(store.nextId)}`,
          body.key,
          body.value_type,
          body.value ?? null,
          body.description ?? null,
        ),
        group: body.group ?? body.key.slice(0, body.key.indexOf('.')),
        is_encrypted: encrypted,
        value: encrypted ? null : (body.value ?? null),
        secret: encrypted && body.value !== null ? JSON.stringify(body.value) : null,
      };
      store.settings.push(row);
      return created(publicSetting(row), `${base}/settings/${row.id}`, row.version);
    }),

    http.patch(`${base}/settings/:id`, async ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const s = findSetting(params.id);
      if (!s) return notFound();
      const conflict = requireIfMatch(request, s.version);
      if (conflict) return conflict;
      const body = (await request.json()) as { group?: string; value?: unknown; description?: string | null };
      let next = { ...s, version: s.version + 1, updated_at: NOW, updated_by: 'usr_manager' };
      if (body.group !== undefined) next = { ...next, group: body.group };
      if (body.description !== undefined) next = { ...next, description: body.description };
      if (body.value !== undefined) {
        const problem = typeError(s.value_type, body.value);
        if (problem) return invalid('value', problem);
        if (s.is_encrypted) {
          if (body.value !== null && !store.canEncrypt) return noKey();
          next = {
            ...next,
            secret: body.value === null ? null : JSON.stringify(body.value),
            has_value: body.value !== null,
          };
        } else next = { ...next, value: body.value, has_value: body.value !== null };
      }
      store.settings = store.settings.map((x) => (x.id === s.id ? next : x));
      return ok(publicSetting(next), { version: next.version });
    }),

    http.delete(`${base}/settings/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      if (!findSetting(params.id)) return notFound();
      store.settings = store.settings.filter((s) => s.id !== params.id);
      return noContent();
    }),
  ];
}

export const handlers: RequestHandler[] = configurationMocks();
