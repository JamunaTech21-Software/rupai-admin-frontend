import { http, type RequestHandler } from 'msw';

import { todayIn } from '@/lib/dates';
import { apiError, created, noContent, ok, page, requireAuth, requireIfMatch } from '@/lib/mocking/contract';

import { DOCUMENT_OWNERS, type DocumentRecord } from './documents';

/**
 * In-memory documents (P1.12) for VITE_MOCK_API=documents and for tests, with the backend rules the screens
 * rely on: a new document is current; a replacement is a new record and supersedes the old one; a correction and a
 * replacement send If-Match; removing archives (the record stays); the same file again is refused on the file; the
 * expiring list defaults to the next 30 days, expired included.
 */

export const MOCK_DOCUMENT_TYPES = [
  { id: 'dt_licence', code: 'LICENCE', name: 'Licence' },
  { id: 'dt_cert', code: 'CERTIFICATE', name: 'Certificate' },
  { id: 'dt_photo', code: 'PHOTOGRAPH', name: 'Photograph' },
];

interface Row extends DocumentRecord {
  /** The document the versions belong to. */
  series: string;
}

/** A business date n days from another (calendar arithmetic only: no time, no zone). */
function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = (value: string) => {
    const [y = 0, m = 1, d = 1] = value.split('-').map((part) => Number.parseInt(part, 10));
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

let sequence = 0;
let store: Row[] = [];

function row(fields: Partial<Row> & Pick<Row, 'id' | 'owner_type' | 'owner_id' | 'series'>): Row {
  const type = MOCK_DOCUMENT_TYPES[0] ?? { id: '', code: '', name: '' };
  return {
    document_type_id: type.id,
    document_type: type,
    title: null,
    file_name: 'file.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 120_000,
    version_number: 1,
    issue_date: null,
    expiry_date: null,
    days_to_expiry: null,
    is_current: true,
    status: 'active',
    uploaded_by_name: 'Demo Manager',
    version: 1,
    created_at: '2026-09-01T04:00:00.000Z',
    ...fields,
  };
}

function seed(): Row[] {
  const today = todayIn();
  const licence = MOCK_DOCUMENT_TYPES[0];
  const cert = MOCK_DOCUMENT_TYPES[1];
  if (!licence || !cert) return [];
  const withExpiry = (expiry: string) => ({
    expiry_date: expiry,
    days_to_expiry: daysBetween(today, expiry),
  });
  return [
    row({
      id: 'doc_fire',
      series: 's_fire',
      owner_type: 'factory',
      owner_id: 'fa1',
      title: 'Fire licence',
      file_name: 'fire-licence-2026.pdf',
      version_number: 2,
      version: 3,
      issue_date: addDays(today, -300),
      ...withExpiry(addDays(today, 12)),
    }),
    row({
      id: 'doc_fire_v1',
      series: 's_fire',
      owner_type: 'factory',
      owner_id: 'fa1',
      title: 'Fire licence',
      file_name: 'fire-licence-2025.pdf',
      is_current: false,
      status: 'superseded',
      ...withExpiry(addDays(today, -40)),
    }),
    row({
      id: 'doc_quality',
      series: 's_quality',
      owner_type: 'factory',
      owner_id: 'fa1',
      document_type_id: cert.id,
      document_type: cert,
      file_name: 'quality-certificate.pdf',
      file_size_bytes: 2_400_000,
    }),
    row({
      id: 'doc_insurance',
      series: 's_insurance',
      owner_type: 'factory',
      owner_id: 'fa1',
      title: 'Insurance',
      file_name: 'insurance.pdf',
      ...withExpiry(addDays(today, 90)),
    }),
    row({
      id: 'doc_land',
      series: 's_land',
      owner_type: 'estate',
      owner_id: 'e1',
      title: 'Land record',
      file_name: 'land-record.pdf',
      ...withExpiry(addDays(today, -5)),
    }),
  ];
}

export function resetDocumentMocks(): void {
  sequence = 0;
  store = seed();
}
resetDocumentMocks();

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const invalid = (field: string, code: string, message: string) =>
  apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [{ field, code, message }]);
const nextId = () => {
  sequence += 1;
  return `doc_new_${String(sequence)}`;
};
const label = (r: Row) =>
  r.owner_type === 'estate' ? 'DEMO-A · Rupai Hills Tea Estate' : 'DEMO-F1 · Rupai Central Factory';
const out = ({ series: _series, ...r }: Row): DocumentRecord => r;

function stamp(r: Row, expiry: string | null): Row {
  return { ...r, expiry_date: expiry, days_to_expiry: expiry ? daysBetween(todayIn(), expiry) : null };
}

export function documentMocks(base = '/api/v1'): RequestHandler[] {
  const find = (id: unknown) => store.find((r) => r.id === id);

  const owners = DOCUMENT_OWNERS.flatMap((owner) => [
    http.get(`${base}${owner.path}/:id/documents`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const history = new URL(request.url).searchParams.get('history') === 'true';
      const rows = store.filter(
        (r) => r.owner_type === owner.type && r.owner_id === params.id && (history || r.status === 'active'),
      );
      return ok(rows.map(out));
    }),
    http.post(`${base}${owner.path}/:id/documents`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const form = await request.formData();
      const file = form.get('file');
      const typeId = form.get('document_type_id');
      const type = MOCK_DOCUMENT_TYPES.find((t) => t.id === typeId);
      if (!(file instanceof File)) return invalid('file', 'FILE_EMPTY', 'Attach a file.');
      if (!type) return invalid('document_type_id', 'NOT_FOUND', 'Choose a document type.');
      if (!/\.(pdf|jpe?g|png|webp|docx|xlsx)$/i.test(file.name))
        return invalid('file', 'FILE_TYPE_NOT_ALLOWED', 'This file type is not accepted.');
      const text = (key: string) => {
        const value = form.get(key);
        return typeof value === 'string' && value !== '' ? value : null;
      };
      const id = nextId();
      const added = stamp(
        row({
          id,
          series: id,
          owner_type: owner.type,
          owner_id: String(params.id),
          document_type_id: type.id,
          document_type: type,
          title: text('title'),
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          issue_date: text('issue_date'),
          created_at: new Date().toISOString(),
        }),
        text('expiry_date'),
      );
      store.push(added);
      return created(out(added), `${base}/documents/${id}`, 1);
    }),
  ]);

  return [
    ...owners,

    http.get(`${base}/documents/expiring`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const from = params.get('filter[expiry_date][from]');
      const to = params.get('filter[expiry_date][to]');
      const ownerType = params.get('filter[owner_type]');
      const typeId = params.get('filter[document_type_id]');
      const limit = from || to ? to : addDays(todayIn(), 30);
      const rows = store
        .filter((r) => r.is_current && r.status === 'active' && r.expiry_date !== null)
        .filter((r) => (from ? (r.expiry_date ?? '') >= from : true))
        .filter((r) => (limit ? (r.expiry_date ?? '') <= limit : true))
        .filter((r) => (ownerType ? r.owner_type === ownerType : true))
        .filter((r) => (typeId ? r.document_type_id === typeId : true))
        .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''));
      return page(
        request,
        rows.map((r) => ({ ...out(r), owner_label: label(r) })),
      );
    }),

    http.get(`${base}/documents/:id/versions`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const doc = find(params.id);
      if (!doc) return notFound();
      return ok(
        store
          .filter((r) => r.series === doc.series)
          .sort((a, b) => b.version_number - a.version_number)
          .map(out),
      );
    }),

    http.get(`${base}/documents/:id/download`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const doc = find(params.id);
      if (!doc) return notFound();
      return ok({
        url: `/api/v1/documents/${doc.id}/content?expires=1&signature=mock-signature-for-${doc.id}`,
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        file_name: doc.file_name,
        mime_type: doc.mime_type,
        file_size_bytes: doc.file_size_bytes,
      });
    }),

    http.post(`${base}/documents/:id/replace`, async ({ request, params }) => {
      const doc = find(params.id);
      if (!doc) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, doc.version);
      if (refused) return refused;
      if (!doc.is_current || doc.status !== 'active')
        return apiError(409, 'INVALID_TRANSITION', 'Only the current version can be replaced.');
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return invalid('file', 'FILE_EMPTY', 'Attach a file.');
      if (file.name === doc.file_name && file.size === doc.file_size_bytes)
        return invalid('file', 'FILE_UNCHANGED', 'This is the same file as the current version.');
      const text = (key: string, fallback: string | null) => {
        const value = form.get(key);
        return typeof value === 'string' && value !== '' ? value : fallback;
      };
      const id = nextId();
      doc.is_current = false;
      doc.status = 'superseded';
      const next = stamp(
        {
          ...doc,
          id,
          title: text('title', doc.title),
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          issue_date: text('issue_date', doc.issue_date),
          version_number: doc.version_number + 1,
          is_current: true,
          status: 'active',
          version: 1,
          created_at: new Date().toISOString(),
        },
        text('expiry_date', doc.expiry_date),
      );
      store.push(next);
      return created(out(next), `${base}/documents/${id}`, 1);
    }),

    http.patch(`${base}/documents/:id`, async ({ request, params }) => {
      const doc = find(params.id);
      if (!doc) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, doc.version);
      if (refused) return refused;
      if (!doc.is_current || doc.status !== 'active')
        return apiError(409, 'INVALID_TRANSITION', 'Only the current version can be corrected.');
      const body = (await request.json()) as {
        title?: string | null;
        issue_date?: string | null;
        expiry_date?: string | null;
      };
      if (body.issue_date && body.expiry_date && body.expiry_date < body.issue_date)
        return invalid('expiry_date', 'VALIDATION_FAILED', 'Must not be before the issue date.');
      if (body.title !== undefined) doc.title = body.title;
      if (body.issue_date !== undefined) doc.issue_date = body.issue_date;
      if (body.expiry_date !== undefined) Object.assign(doc, stamp(doc, body.expiry_date));
      doc.version += 1;
      return ok(out(doc), { version: doc.version });
    }),

    http.delete(`${base}/documents/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const doc = find(params.id);
      if (!doc) return notFound();
      doc.status = 'archived';
      doc.is_current = false;
      return noContent();
    }),
  ];
}

export const handlers: RequestHandler[] = documentMocks();
