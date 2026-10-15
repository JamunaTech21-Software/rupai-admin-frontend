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
import { Dec } from '@/lib/money';

import { calendarMocks, mockHasFiscalYears, resetCalendarMocks } from './calendarMocks';

import {
  type Contact,
  type Division,
  type Estate,
  type Factory,
  type Field,
  type Organisation,
  type Party,
  type Section,
  type Warehouse,
} from './schemas';

/**
 * In-memory organisation hierarchy (P1.07) for VITE_MOCK_API=organisation and for tests. It follows the backend
 * rules the screens depend on: If-Match on every change, unique codes per parent and field numbers per estate
 * (DUPLICATE_KEY), planted ≤ gross area, nothing new under an inactive parent, REFERENCED_RECORD when deleting a
 * node with anything under it, effective-dated section reassignment, and `meta.applied_scope` on lists.
 */

const NOW = '2026-01-01T04:00:00.000Z';

interface Store {
  organisation: Organisation;
  estates: Estate[];
  divisions: Division[];
  sections: Section[];
  fields: Field[];
  sequence: number;
  /** null: all estates; otherwise the estate ids a scoped user sees. */
  scope: string[] | null;
  factories: Factory[];
  warehouses: Warehouse[];
  parties: Party[];
  contacts: Contact[];
  /** Estate photographs (R.2): documents of type Photograph. */
  photos: MockPhoto[];
}

interface MockPhoto {
  id: string;
  owner_id: string;
  title: string | null;
  file_name: string;
  mime_type: string;
  version: number;
}

const base = { status: 'active' as const, version: 1, created_at: NOW, updated_at: null };

function seed(): Store {
  const estate = (id: string, code: string, name: string): Estate => ({
    ...base,
    id,
    organisation_id: '1',
    code,
    name,
    location: null,
    address_line1: null,
    district: 'Moulvibazar',
    total_area: null,
    manager_profile_id: null,
    phone: null,
    email: null,
    established_on: null,
    ownership_type: 'owned',
    remarks: null,
    established_year: null,
    owner_name: null,
    estate_type: null,
    estate_category: null,
    police_station: null,
    admin_division: null,
    country_id: null,
    postal_code: null,
    website: null,
    latitude: null,
    longitude: null,
    description: null,
    amenities: [],
    other_amenities: null,
  });
  const division = (id: string, estate_id: string, code: string, name: string): Division => ({
    ...base,
    id,
    estate_id,
    code,
    name,
    manager_profile_id: null,
    area: null,
  });
  const section = (
    id: string,
    division_id: string,
    estate_id: string,
    code: string,
    name: string,
  ): Section => ({
    ...base,
    id,
    division_id,
    estate_id,
    code,
    name,
    supervisor_profile_id: null,
    area: null,
  });
  const field = (id: string, s: Section, field_number: string, gross: string, planted: string): Field => ({
    ...base,
    id,
    estate_id: s.estate_id,
    division_id: s.division_id,
    section_id: s.id,
    field_number,
    name: null,
    gross_area: gross,
    planted_area: planted,
    field_status: 'producing',
    section_effective_from: '2025-01-01',
    remarks: null,
  });
  const sections = [
    section('s1', 'd1', 'e1', 'N1', 'North 1'),
    section('s2', 'd1', 'e1', 'N2', 'North 2'),
    section('s3', 'd2', 'e1', 'S1', 'South 1'),
    section('s4', 'd3', 'e2', 'V1', 'Valley 1'),
  ];
  const [s1, s2, , s4] = sections as [Section, Section, Section, Section];
  return {
    organisation: {
      id: '1',
      name: 'Rupai Tea Company Ltd.',
      short_name: 'RUPAI',
      registration_number: null,
      tin: null,
      vat_registration: null,
      address_line1: null,
      address_line2: null,
      city: 'Sylhet',
      postal_code: null,
      country_id: 'co_bd',
      phone: null,
      email: null,
      website: null,
      logo_path: null,
      base_currency_id: 'cur_bdt',
      fiscal_year_start_month: 7,
      status: 'active',
      version: 1,
      updated_at: null,
    },
    estates: [
      estate('e1', 'DEMO-A', 'Rupai Hills Tea Estate'),
      estate('e2', 'DEMO-B', 'Jamuna Valley Tea Estate'),
    ],
    divisions: [
      division('d1', 'e1', 'N', 'North'),
      division('d2', 'e1', 'S', 'South'),
      division('d3', 'e2', 'V', 'Valley'),
      division('d4', 'e2', 'EMPTY', 'Empty division'),
    ],
    sections,
    fields: [
      field('f1', s1, 'A-N1-1', '12.500', '11.750'),
      field('f2', s1, 'A-N1-2', '8.000', '8.000'),
      field('f3', s2, 'A-N2-1', '10.250', '9.000'),
      field('f4', s4, 'B-V1-1', '15.000', '14.500'),
    ],
    sequence: 0,
    scope: null,
    factories: [
      {
        ...base,
        id: 'fa1',
        code: 'DEMO-F1',
        name: 'Rupai Central Factory',
        factory_type: 'own',
        primary_estate_id: 'e1',
        location: null,
        daily_capacity_kg: '45000.000',
        manager_profile_id: null,
        licence_number: 'TB-123',
        // Long past: the list flags it as expired.
        licence_expiry: '2020-06-30',
      },
    ],
    warehouses: [
      {
        ...base,
        id: 'w1',
        code: 'DEMO-W1',
        name: 'Chattogram Auction Warehouse',
        warehouse_type: 'rented',
        location: 'Chattogram',
        capacity_kg: '250000.000',
        keeper_profile_id: null,
        phone: '+8801711000001',
        licence_number: null,
        licence_expiry: null,
        tin: null,
        vat_registration: null,
      },
    ],
    parties: [
      {
        ...base,
        id: 'p1',
        party_type: 'individual',
        code: 'DEMO-P1',
        name: 'Abdul Haque (lessee)',
        national_id: null,
        registration_number: null,
        address_line1: null,
        district: 'Moulvibazar',
        phone: null,
        email: null,
      },
    ],
    contacts: [
      {
        ...base,
        id: 'c1',
        owner_type: 'warehouse',
        owner_id: 'w1',
        contact_name: 'Karim Uddin',
        designation: 'Warehouse in-charge',
        contact_type: 'primary',
        phone: '+8801711000001',
        phone_alt: null,
        email: null,
        is_primary: true,
      },
      {
        ...base,
        id: 'c2',
        owner_type: 'warehouse',
        owner_id: 'w1',
        contact_name: 'Salma Begum',
        designation: 'Accounts',
        contact_type: 'accounts',
        phone: '+8801711000002',
        phone_alt: null,
        email: null,
        is_primary: false,
      },
      {
        ...base,
        id: 'c3',
        owner_type: 'estate',
        owner_id: 'e1',
        contact_name: 'Abdul Karim',
        designation: 'Estate Manager',
        contact_type: 'estate_manager',
        phone: '+8801711000010',
        phone_alt: null,
        email: 'manager@rupai.example',
        is_primary: true,
      },
    ],
    photos: [
      {
        id: 'doc1',
        owner_id: 'e1',
        title: 'Tea garden',
        file_name: 'garden.jpg',
        mime_type: 'image/jpeg',
        version: 1,
      },
    ],
  };
}

let store = seed();

/** Back to the seeded hierarchy (between tests). */
export function resetOrganisationMocks(): void {
  store = seed();
  resetCalendarMocks();
}

/** Make the lists behave as for a user scoped to these estates (null: all estates). */
export function setMockEstateScope(estateIds: string[] | null): void {
  store.scope = estateIds;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const nextId = (prefix: string) => {
  store.sequence += 1;
  return `${prefix}_new_${String(store.sequence)}`;
};
const touch = <T extends { version: number; updated_at: string | null }>(row: T): T => {
  row.version += 1;
  row.updated_at = new Date().toISOString();
  return row;
};
const duplicate = (field: string, message: string) =>
  apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
    { field, code: 'DUPLICATE_KEY', message },
  ]);
const inactiveParent = (field: string, what: string) =>
  apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
    { field, code: 'INACTIVE_PARENT', message: `The ${what} is inactive.` },
  ]);
const referenced = () =>
  apiError(422, 'REFERENCED_RECORD', 'This record is still in use.', [
    { code: 'REFERENCED_RECORD', message: 'It has records under it. Deactivate it instead.' },
  ]);
const appliedScope = () => ({
  all_estates: store.scope === null,
  estates: store.scope ?? [],
  divisions: [],
  sections: [],
});
const visible = (estateId: string) => store.scope === null || store.scope.includes(estateId);

/** A page of rows, with pagination and the applied scope in meta. */
function scopedPage(request: Request, rows: readonly Record<string, unknown>[]) {
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
        applied_scope: appliedScope(),
      },
    },
    { headers: { 'X-Environment': 'mock' } },
  );
}

type NodePath = 'estates' | 'divisions' | 'sections' | 'fields' | 'factories' | 'warehouses' | 'parties';
const tables = () => ({
  estates: store.estates,
  divisions: store.divisions,
  sections: store.sections,
  fields: store.fields,
  factories: store.factories,
  warehouses: store.warehouses,
  parties: store.parties,
});
const hasChildren = (path: NodePath, id: string) =>
  (path === 'estates' && store.divisions.some((d) => d.estate_id === id)) ||
  (path === 'divisions' && store.sections.some((s) => s.division_id === id)) ||
  (path === 'sections' && store.fields.some((f) => f.section_id === id));

// ---- Facilities, parties and contacts (P1.08) --------------------------------------------------------------

const OWNER_TYPE = { warehouses: 'warehouse', parties: 'party', estates: 'estate' } as const;
type OwnerPath = keyof typeof OWNER_TYPE;

/** The owner's contacts, primary first. */
const contactsOf = (path: OwnerPath, id: string) => {
  const own = store.contacts.filter((c) => c.owner_type === OWNER_TYPE[path] && c.owner_id === id);
  return [...own.filter((c) => c.is_primary), ...own.filter((c) => !c.is_primary)];
};

/** warehouse.phone mirrors the primary contact's phone. */
function syncWarehousePhone(id: string) {
  const warehouse = store.warehouses.find((w) => w.id === id);
  if (warehouse) warehouse.phone = contactsOf('warehouses', id).find((c) => c.is_primary)?.phone ?? null;
}

// ---- Estate profile (R.2) -----------------------------------------------------------------------------------

/** The facility list (GET /lookups/amenity), as the backend seeds it. */
export const MOCK_AMENITIES = [
  { id: 'am1', code: 'WAREHOUSE', name: 'Warehouse' },
  { id: 'am2', code: 'HOSPITAL', name: 'Hospital / dispensary' },
  { id: 'am3', code: 'SCHOOL', name: 'School' },
  { id: 'am4', code: 'WATER_SUPPLY', name: 'Water supply' },
];
/** The Photograph document type (GET /lookups/document_type). */
export const MOCK_PHOTOGRAPH_TYPE = { id: 'dt_photo', code: 'PHOTOGRAPH', name: 'Photograph' };

/** An estate body as stored: amenity_ids (what the client sends) become amenities (what it reads). */
function withAmenities(body: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(body.amenity_ids)) return body;
  const { amenity_ids: ids, ...rest } = body as { amenity_ids: string[] } & Record<string, unknown>;
  return { ...rest, amenities: MOCK_AMENITIES.filter((a) => ids.includes(a.id)) };
}

const photoOut = (photo: MockPhoto) => ({
  id: photo.id,
  owner_type: 'estate',
  owner_id: photo.owner_id,
  title: photo.title,
  file_name: photo.file_name,
  mime_type: photo.mime_type,
  document_type: MOCK_PHOTOGRAPH_TYPE,
  status: 'active',
  version: photo.version,
});

/** A 1×1 PNG, standing in for every photograph. */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function estateProfileMocks(b: string): RequestHandler[] {
  const estate = (id: unknown) => store.estates.find((e) => e.id === id);
  return [
    http.get(`${b}/estates/:id/summary`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = estate(params.id);
      if (!row) return notFound();
      const fields = store.fields.filter((f) => f.estate_id === row.id && f.status === 'active');
      const tea = fields.reduce((sum, f) => sum.plus(f.planted_area ?? '0'), new Dec('0'));
      const gross = fields.reduce((sum, f) => sum.plus(f.gross_area), new Dec('0'));
      const divisions = store.divisions.filter((d) => d.estate_id === row.id);
      return ok({
        estate_id: row.id,
        total_land_area: row.total_area,
        tea_area: tea.toFixed(3),
        non_tea_area: row.total_area
          ? Dec.max(new Dec(row.total_area).minus(tea), new Dec('0')).toFixed(3)
          : null,
        field_area: gross.toFixed(3),
        division_count: divisions.length,
        section_count: store.sections.filter((s) => divisions.some((d) => d.id === s.division_id)).length,
        field_count: fields.length,
        factory_count: store.factories.filter((f) => f.primary_estate_id === row.id).length,
        worker_count: 0,
        family_count: 0,
        workforce_available: false,
        photo_count: store.photos.filter((p) => p.owner_id === row.id).length,
      });
    }),
    http.get(`${b}/estates/:id/documents`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      if (!estate(params.id)) return notFound();
      return ok(store.photos.filter((p) => p.owner_id === params.id).map(photoOut));
    }),
    http.post(`${b}/estates/:id/documents`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      if (!estate(params.id)) return notFound();
      const form = await request.formData();
      const file = form.get('file');
      const title = form.get('title');
      if (!(file instanceof File))
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'file', code: 'REQUIRED', message: 'Attach a file.' },
        ]);
      const photo: MockPhoto = {
        id: nextId('doc'),
        owner_id: String(params.id),
        title: typeof title === 'string' ? title : null,
        file_name: file.name,
        mime_type: file.type,
        version: 1,
      };
      store.photos.push(photo);
      return created(photoOut(photo), `${b}/documents/${photo.id}`, 1);
    }),
    http.get(`${b}/documents/:id/download`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const photo = store.photos.find((p) => p.id === params.id);
      if (!photo) return notFound();
      return ok({
        url: PIXEL,
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        file_name: photo.file_name,
        mime_type: photo.mime_type,
        file_size_bytes: 68,
      });
    }),
    http.delete(`${b}/documents/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const index = store.photos.findIndex((p) => p.id === params.id);
      if (index < 0) return notFound();
      store.photos.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

function facilityMocks(b: string): RequestHandler[] {
  const createMaster = <T extends { id: string; code: string }>(
    path: 'factories' | 'warehouses' | 'parties',
    prefix: string,
    defaults: Omit<T, 'id' | 'code'>,
  ) =>
    http.post(`${b}/${path}`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Record<string, unknown> & { code: string };
      if (path === 'warehouses' && 'phone' in body) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'phone', code: 'UNRECOGNIZED', message: 'The phone comes from the primary contact.' },
        ]);
      }
      const list = store[path] as unknown as T[];
      if (list.some((row) => row.code === body.code)) return duplicate('code', 'This code is already used.');
      const row = {
        ...defaults,
        ...body,
        id: nextId(prefix),
        created_at: new Date().toISOString(),
      } as unknown as T;
      list.push(row);
      return created(row, `${b}/${path}/${row.id}`, 1);
    });

  const ownerHandlers = (['warehouses', 'parties', 'estates'] as const).flatMap((path) => {
    const owner = (id: unknown) => (store[path] as { id: string }[]).find((o) => o.id === id);
    const contact = (ownerId: unknown, contactId: unknown) =>
      contactsOf(path, String(ownerId)).find((c) => c.id === contactId);
    return [
      http.get(`${b}/${path}/:id/contacts`, ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        if (!owner(params.id)) return notFound();
        return scopedPage(request, contactsOf(path, String(params.id)));
      }),
      http.post(`${b}/${path}/:id/contacts`, async ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        if (!owner(params.id)) return notFound();
        const body = (await request.json()) as Partial<Contact> & {
          contact_name: string;
          is_primary?: boolean;
        };
        const existing = contactsOf(path, String(params.id));
        const primary = existing.length === 0 || body.is_primary === true;
        if (primary) for (const c of existing) c.is_primary = false;
        const row: Contact = {
          ...base,
          id: nextId('c'),
          owner_type: OWNER_TYPE[path],
          owner_id: String(params.id),
          designation: null,
          contact_type: 'other',
          phone: null,
          phone_alt: null,
          email: null,
          ...body,
          is_primary: primary,
        };
        store.contacts.push(row);
        if (path === 'warehouses') syncWarehousePhone(String(params.id));
        return created(row, `${b}/${path}/${String(params.id)}/contacts/${row.id}`, 1);
      }),
      ...(['put', 'patch'] as const).map((method) =>
        http[method](`${b}/${path}/:id/contacts/:contactId`, async ({ request, params }) => {
          const row = contact(params.id, params.contactId);
          if (!row) return notFound();
          const refused = requireAuth(request) ?? requireIfMatch(request, row.version);
          if (refused) return refused;
          Object.assign(row, (await request.json()) as Partial<Contact>);
          if (path === 'warehouses') syncWarehousePhone(String(params.id));
          return ok(touch(row), { version: row.version });
        }),
      ),
      http.post(`${b}/${path}/:id/contacts/:contactId/make-primary`, ({ request, params }) => {
        const row = contact(params.id, params.contactId);
        if (!row) return notFound();
        const refused = requireAuth(request) ?? requireIfMatch(request, row.version);
        if (refused) return refused;
        for (const c of contactsOf(path, String(params.id))) c.is_primary = c.id === row.id;
        if (path === 'warehouses') syncWarehousePhone(String(params.id));
        return ok(touch(row), { version: row.version });
      }),
      http.delete(`${b}/${path}/:id/contacts/:contactId`, ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const row = contact(params.id, params.contactId);
        if (!row) return notFound();
        store.contacts = store.contacts.filter((c) => c.id !== row.id);
        if (path === 'warehouses') syncWarehousePhone(String(params.id));
        return noContent();
      }),
    ];
  });

  return [
    http.get(`${b}/factories`, ({ request }) => requireAuth(request) ?? scopedPage(request, store.factories)),
    http.get(
      `${b}/warehouses`,
      ({ request }) => requireAuth(request) ?? scopedPage(request, store.warehouses),
    ),
    http.get(`${b}/parties`, ({ request }) => requireAuth(request) ?? scopedPage(request, store.parties)),
    createMaster<Factory>('factories', 'fa', {
      ...base,
      name: '',
      factory_type: 'own',
      primary_estate_id: null,
      location: null,
      daily_capacity_kg: null,
      manager_profile_id: null,
      licence_number: null,
      licence_expiry: null,
    }),
    createMaster<Warehouse>('warehouses', 'w', {
      ...base,
      name: '',
      warehouse_type: 'own',
      location: null,
      capacity_kg: null,
      keeper_profile_id: null,
      phone: null,
      licence_number: null,
      licence_expiry: null,
      tin: null,
      vat_registration: null,
    }),
    createMaster<Party>('parties', 'p', {
      ...base,
      party_type: 'individual',
      name: '',
      national_id: null,
      registration_number: null,
      address_line1: null,
      district: null,
      phone: null,
      email: null,
    }),
    ...ownerHandlers,
  ];
}

export function organisationMocks(apiBase = '/api/v1'): RequestHandler[] {
  const b = apiBase;
  return [
    // ---- Organisation ----
    http.get(
      `${b}/organisation`,
      ({ request }) =>
        requireAuth(request) ?? ok(store.organisation, { version: store.organisation.version }),
    ),
    http.put(`${b}/organisation`, async ({ request }) => {
      const refused = requireAuth(request) ?? requireIfMatch(request, store.organisation.version);
      if (refused) return refused;
      const changes = (await request.json()) as Partial<Organisation>;
      if (
        mockHasFiscalYears() &&
        changes.fiscal_year_start_month !== undefined &&
        changes.fiscal_year_start_month !== store.organisation.fiscal_year_start_month
      ) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'fiscal_year_start_month',
            code: 'VALIDATION_FAILED',
            message: 'cannot be changed once a fiscal year exists',
          },
        ]);
      }
      Object.assign(store.organisation, changes);
      return ok(touch(store.organisation), { version: store.organisation.version });
    }),

    // ---- Estates ----
    http.get(
      `${b}/estates`,
      ({ request }) =>
        requireAuth(request) ??
        scopedPage(
          request,
          store.estates.filter((e) => visible(e.id)),
        ),
    ),
    http.post(`${b}/estates`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Estate> & { code: string; name: string };
      if (store.estates.some((e) => e.code === body.code))
        return duplicate('code', 'An estate with this code already exists.');
      const estate = {
        ...base,
        id: nextId('e'),
        organisation_id: '1',
        location: null,
        address_line1: null,
        district: null,
        total_area: null,
        manager_profile_id: null,
        phone: null,
        email: null,
        established_on: null,
        ownership_type: null,
        remarks: null,
        established_year: null,
        owner_name: null,
        estate_type: null,
        estate_category: null,
        police_station: null,
        admin_division: null,
        country_id: null,
        postal_code: null,
        website: null,
        latitude: null,
        longitude: null,
        description: null,
        amenities: [],
        other_amenities: null,
        code: body.code,
        name: body.name,
        ...withAmenities(body),
        created_at: new Date().toISOString(),
      } as Estate;
      store.estates.push(estate);
      return created(estate, `${b}/estates/${estate.id}`, estate.version);
    }),
    http.get(
      `${b}/estates/:id/divisions`,
      ({ request, params }) =>
        requireAuth(request) ??
        scopedPage(
          request,
          store.divisions.filter((d) => d.estate_id === params.id),
        ),
    ),
    http.post(`${b}/estates/:id/divisions`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const estate = store.estates.find((e) => e.id === params.id);
      if (!estate) return notFound();
      if (estate.status !== 'active') return inactiveParent('estate_id', 'estate');
      const body = (await request.json()) as { code: string; name: string; area: string | null };
      if (store.divisions.some((d) => d.estate_id === estate.id && d.code === body.code)) {
        return duplicate('code', 'A division with this code already exists in this estate.');
      }
      const division: Division = {
        ...base,
        id: nextId('d'),
        estate_id: estate.id,
        manager_profile_id: null,
        ...body,
      };
      store.divisions.push(division);
      return created(division, `${b}/divisions/${division.id}`, division.version);
    }),
    http.get(
      `${b}/divisions/:id/sections`,
      ({ request, params }) =>
        requireAuth(request) ??
        scopedPage(
          request,
          store.sections.filter((s) => s.division_id === params.id),
        ),
    ),
    http.post(`${b}/divisions/:id/sections`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const division = store.divisions.find((d) => d.id === params.id);
      if (!division) return notFound();
      if (division.status !== 'active') return inactiveParent('division_id', 'division');
      const body = (await request.json()) as { code: string; name: string; area: string | null };
      if (store.sections.some((s) => s.division_id === division.id && s.code === body.code)) {
        return duplicate('code', 'A section with this code already exists in this division.');
      }
      const section: Section = {
        ...base,
        id: nextId('s'),
        division_id: division.id,
        estate_id: division.estate_id,
        supervisor_profile_id: null,
        ...body,
      };
      store.sections.push(section);
      return created(section, `${b}/sections/${section.id}`, section.version);
    }),

    // ---- Fields ----
    http.get(
      `${b}/fields`,
      ({ request }) =>
        requireAuth(request) ??
        scopedPage(
          request,
          store.fields.filter((f) => visible(f.estate_id)),
        ),
    ),
    http.post(`${b}/fields`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Partial<Field> & {
        section_id: string;
        field_number: string;
        gross_area: string;
      };
      const section = store.sections.find((s) => s.id === body.section_id);
      if (!section) return notFound();
      if (section.status !== 'active') return inactiveParent('section_id', 'section');
      if (
        store.fields.some((f) => f.estate_id === section.estate_id && f.field_number === body.field_number)
      ) {
        return duplicate('field_number', 'This field number is already used in this estate.');
      }
      if (body.planted_area && new Dec(body.planted_area).gt(body.gross_area)) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'planted_area', code: 'TOO_LARGE', message: 'Cannot be larger than the gross area.' },
        ]);
      }
      const field: Field = {
        ...base,
        id: nextId('f'),
        estate_id: section.estate_id,
        division_id: section.division_id,
        name: null,
        planted_area: null,
        field_status: 'producing',
        remarks: null,
        section_effective_from: new Date().toISOString().slice(0, 10),
        ...body,
        created_at: new Date().toISOString(),
      };
      store.fields.push(field);
      return created(field, `${b}/fields/${field.id}`, field.version);
    }),
    http.post(`${b}/fields/:id/reassign-section`, async ({ request, params }) => {
      const field = store.fields.find((f) => f.id === params.id);
      if (!field) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, field.version);
      if (refused) return refused;
      const body = (await request.json()) as { section_id: string; effective_from: string };
      const section = store.sections.find((s) => s.id === body.section_id);
      if (section?.estate_id !== field.estate_id) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'section_id',
            code: 'OTHER_ESTATE',
            message: 'The new section must be in the same estate.',
          },
        ]);
      }
      if (field.section_effective_from && body.effective_from <= field.section_effective_from) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'effective_from',
            code: 'TOO_EARLY',
            message: 'Must be after the field joined its current section.',
          },
        ]);
      }
      Object.assign(field, {
        section_id: section.id,
        division_id: section.division_id,
        section_effective_from: body.effective_from,
      });
      return ok(touch(field), { version: field.version });
    }),

    // ---- Shared by every node: read, replace, status, delete ----
    ...estateProfileMocks(b),
    ...facilityMocks(b),

    ...(
      ['estates', 'divisions', 'sections', 'fields', 'factories', 'warehouses', 'parties'] as const
    ).flatMap((path) => [
      http.get(`${b}/${path}/:id`, ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const row = (tables()[path] as { id: string; version: number }[]).find((r) => r.id === params.id);
        return row ? ok(row, { version: row.version }) : notFound();
      }),
      ...(['put', 'patch'] as const).map((method) =>
        http[method](`${b}/${path}/:id`, async ({ request, params }) => {
          const row = (tables()[path] as Record<string, unknown>[]).find((r) => r.id === params.id) as
            { id: string; version: number; updated_at: string | null; gross_area?: string } | undefined;
          if (!row) return notFound();
          const refused = requireAuth(request) ?? requireIfMatch(request, row.version);
          if (refused) return refused;
          const body = (await request.json()) as Record<string, unknown>;
          if (
            path === 'fields' &&
            typeof body.planted_area === 'string' &&
            typeof body.gross_area === 'string'
          ) {
            if (new Dec(body.planted_area).gt(body.gross_area)) {
              return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
                {
                  field: 'planted_area',
                  code: 'TOO_LARGE',
                  message: 'Cannot be larger than the gross area.',
                },
              ]);
            }
          }
          Object.assign(row, path === 'estates' ? withAmenities(body) : body);
          return ok(touch(row), { version: row.version });
        }),
      ),
      http.post(`${b}/${path}/:id/:action`, ({ request, params }) => {
        if (params.action !== 'deactivate' && params.action !== 'reactivate') return notFound();
        const row = (
          tables()[path] as { id: string; version: number; status: string; updated_at: string | null }[]
        ).find((r) => r.id === params.id);
        if (!row) return notFound();
        const refused = requireAuth(request) ?? requireIfMatch(request, row.version);
        if (refused) return refused;
        row.status = params.action === 'deactivate' ? 'inactive' : 'active';
        return ok(touch(row), { version: row.version });
      }),
      http.delete(`${b}/${path}/:id`, ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const id = String(params.id);
        const list = tables()[path] as { id: string }[];
        if (!list.some((r) => r.id === id)) return notFound();
        if (hasChildren(path, id)) return referenced();
        const index = list.findIndex((r) => r.id === id);
        list.splice(index, 1);
        return noContent();
      }),
    ]),
    ...calendarMocks(b, () => store.organisation.fiscal_year_start_month),
  ];
}

/** For the app's mock loader (VITE_MOCK_API=organisation). */
export const handlers: RequestHandler[] = organisationMocks();
