import { http, HttpResponse, type RequestHandler } from 'msw';

import { apiError, ok, page, requireAuth } from '@/lib/mocking/contract';

import { type Batch, type ErrorLine } from './imports';

/**
 * In-memory imports (P1.17) for VITE_MOCK_API=imports and for tests, with the backend's rules: an upload becomes a
 * batch being validated, which settles on the next read: a file without the required column is rejected (with the
 * problem named), otherwise it is validated with its good and bad rows counted; commit is allowed only with at least
 * one valid row and saves only those; cancel is allowed until the batch is saved; someone else's batch is 404; a
 * user without the type's create permission is refused (403). A file's rows are its lines: a line whose first cell is
 * empty is bad (REQUIRED), a repeated first cell is bad (DUPLICATE_KEY), the rest are good.
 */

const NOW = '2026-10-18T06:00:00.000Z';
const ME = { id: 'usr_manager', username: 'manager' };

const TYPES = [
  {
    key: 'lookup.amenity',
    label: 'Amenities',
    permission: 'lookup',
    max_rows: 1000,
    columns: [
      { name: 'code', required: true, description: 'A short unique code', example: 'CRECHE' },
      { name: 'name', required: true, description: 'What people see', example: 'Creche' },
    ],
  },
  {
    key: 'lookup.soil_type',
    label: 'Soil types',
    permission: 'lookup',
    max_rows: 1000,
    columns: [
      { name: 'code', required: true, description: 'A short unique code', example: 'LOAM' },
      { name: 'name', required: true, description: 'What people see', example: 'Loam' },
    ],
  },
];

interface Entry {
  batch: Batch;
  lines: string[][];
  errors: ErrorLine[];
  /** Reads left before a validating or committing batch settles. */
  settleIn: number;
  header: string[];
}

let entries: Entry[] = [];
let sequence = 0;

export function resetImportMocks(): void {
  entries = [];
  sequence = 0;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The import does not exist.');
const find = (id: string | readonly string[] | undefined) => entries.find((e) => e.batch.id === id);

function jobFor(id: string, label: string) {
  return {
    id: `job_${id}`,
    type: 'import',
    label,
    state: 'running' as const,
    progress: { done: 1, total: 4 },
    poll_after_seconds: 1,
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: null,
    queued_at: NOW,
    started_at: NOW,
    finished_at: null,
    result: null,
    error: null,
    requested_by: ME,
    schedule: null,
    expires_at: null,
  };
}

/** Parse the uploaded text file into its header and lines (a csv, as the tests send). */
function parse(text: string): { header: string[]; lines: string[][] } {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => line.split(',').map((cell) => cell.trim()));
  return { header: rows[0] ?? [], lines: rows.slice(1) };
}

function settle(entry: Entry, type: (typeof TYPES)[number]): void {
  const b = entry.batch;
  if (b.state !== 'validating' && b.state !== 'committing') return;
  entry.settleIn -= 1;
  if (entry.settleIn > 0) return;
  b.job = null;
  if (b.state === 'committing') {
    b.state = 'committed';
    b.committed_at = NOW;
    b.can_cancel = false;
    b.can_commit = false;
    return;
  }
  const missing = type.columns.filter((c) => c.required && !entry.header.includes(c.name));
  if (missing.length > 0) {
    b.state = 'rejected';
    b.problems = missing.map((c) => ({ code: 'MISSING_COLUMN', message: `Column ${c.name} is required.` }));
    b.can_cancel = true;
    return;
  }
  const seen = new Set<string>();
  entry.lines.forEach((line, index) => {
    const key = line[0] ?? '';
    const row = index + 2;
    if (key === '')
      entry.errors.push({ row_number: row, column: 'code', code: 'REQUIRED', message: 'Code is required.' });
    else if (seen.has(key))
      entry.errors.push({
        row_number: row,
        column: 'code',
        code: 'DUPLICATE_KEY',
        message: 'Code is repeated in the file.',
      });
    seen.add(key);
  });
  b.state = 'validated';
  b.validated_at = NOW;
  b.row_count = entry.lines.length;
  b.error_count = entry.errors.length;
  b.valid_count = b.row_count - b.error_count;
  b.can_commit = b.valid_count > 0;
  b.can_cancel = true;
}

const out = (entry: Entry): Batch => {
  const type = TYPES.find((t) => t.key === entry.batch.import_type) ?? TYPES[0];
  if (type) settle(entry, type);
  return { ...entry.batch };
};

/**
 * What the server answers to an upload of `file` as an import of `typeKey`. Exported so a test can answer the browser's
 * multipart request itself (the test environment cannot stream a FormData through fetch).
 */
export async function uploadResponse(typeKey: string, file: File | null): Promise<Response> {
  const type = TYPES.find((t) => t.key === typeKey);
  if (!type) return notFound();
  if (!file)
    return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
      { field: 'file', code: 'REQUIRED', message: 'Attach the file.' },
    ]);
  const { header, lines } = parse(await file.text());
  sequence += 1;
  const id = `imp_${String(sequence)}`;
  const batch: Batch = {
    id,
    import_type: type.key,
    label: type.label,
    state: 'validating',
    file_name: file.name,
    file_format: file.name.endsWith('.csv') ? 'csv' : 'xlsx',
    row_count: 0,
    valid_count: 0,
    error_count: 0,
    committed_count: 0,
    failed_count: 0,
    problems: [],
    can_commit: false,
    can_cancel: true,
    job: jobFor(id, `Checking ${file.name}`),
    validate_job_id: `job_${id}`,
    commit_job_id: null,
    created_by: ME,
    created_at: NOW,
    validated_at: null,
    committed_at: null,
    cancelled_at: null,
    version: 1,
  };
  entries.push({ batch, lines, errors: [], settleIn: 2, header });
  return ok(batch, { status: 202 });
}

export function importMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.get(`${base}/imports/types`, ({ request }) => requireAuth(request) ?? ok(TYPES)),

    http.get(`${base}/imports/templates/:type`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const type = TYPES.find((t) => t.key === params.type);
      if (!type) return notFound();
      const format = new URL(request.url).searchParams.get('format') ?? 'xlsx';
      return new HttpResponse(type.columns.map((c) => c.name).join(',') + '\n', {
        headers: {
          'Content-Type': format === 'csv' ? 'text/csv' : 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${String(params.type)}-template.${format}"`,
        },
      });
    }),

    http.get(`${base}/imports`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const type = params.get('filter[import_type]');
      const state = params.get('filter[state]');
      return page(
        request,
        entries
          .map(out)
          .filter((b) => (type === null || b.import_type === type) && (state === null || b.state === state))
          .reverse(),
      );
    }),

    http.post(`${base}/imports/:type`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const file = (await request.formData()).get('file');
      return uploadResponse(String(params.type), file instanceof File ? file : null);
    }),

    http.get(`${base}/imports/:id/errors/file`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const entry = find(params.id);
      if (!entry) return notFound();
      const format = new URL(request.url).searchParams.get('format') ?? 'xlsx';
      return new HttpResponse(
        'row,column,code,message\n' +
          entry.errors
            .map((e) => `${String(e.row_number)},${e.column ?? ''},${e.code},${e.message}`)
            .join('\n'),
        {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="import-${String(params.id)}-errors.${format}"`,
          },
        },
      );
    }),

    http.get(`${base}/imports/:id/errors`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const entry = find(params.id);
      return entry ? page(request, entry.errors) : notFound();
    }),

    http.post(`${base}/imports/:id/commit`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const entry = find(params.id);
      if (!entry) return notFound();
      const b = entry.batch;
      if (!b.can_commit) return apiError(409, 'INVALID_TRANSITION', 'This import cannot be committed now.');
      b.state = 'committing';
      b.committed_count = b.valid_count;
      b.can_commit = false;
      b.can_cancel = false;
      b.job = jobFor(b.id, `Saving ${b.file_name}`);
      b.commit_job_id = `job_c_${b.id}`;
      entry.settleIn = 2;
      return ok({ ...b }, { status: 202 });
    }),

    http.post(`${base}/imports/:id/cancel`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const entry = find(params.id);
      if (!entry) return notFound();
      const b = entry.batch;
      if (!b.can_cancel) return apiError(409, 'INVALID_TRANSITION', 'This import cannot be cancelled now.');
      b.state = 'cancelled';
      b.cancelled_at = NOW;
      b.can_cancel = false;
      b.can_commit = false;
      b.job = null;
      return ok({ ...b });
    }),

    http.get(`${base}/imports/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const entry = find(params.id);
      return entry ? ok(out(entry)) : notFound();
    }),
  ];
}

export const handlers: RequestHandler[] = importMocks();
