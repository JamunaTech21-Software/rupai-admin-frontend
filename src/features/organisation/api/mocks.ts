import type { Geometry } from 'geojson';
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
  FIELD_TYPES,
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

/** A square of `size` degrees with its south-west corner at (lng, lat): enough of a shape for a map. */
function square(lng: number, lat: number, size: number): Geometry {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng, lat],
        [lng + size, lat],
        [lng + size, lat + size],
        [lng, lat + size],
        [lng, lat],
      ],
    ],
  };
}

const ACRES_PER_DEG2 = 24_500_000;
const mappedAcres = (geometry: Geometry) => {
  if (geometry.type !== 'Polygon') return null;
  const ring = geometry.coordinates[0] ?? [];
  const xs = ring.map((point) => point[0] ?? 0);
  const ys = ring.map((point) => point[1] ?? 0);
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  return (area * ACRES_PER_DEG2).toFixed(3);
};

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
  /** Drawn shapes by field id (R.3 GIS), as GeoJSON; a field without one is not mapped yet. */
  shapes: Record<string, Geometry>;
  /** Section outlines by section id. */
  outlines: Record<string, Geometry>;
}

interface MockPhoto {
  id: string;
  owner_id: string;
  title: string | null;
  file_name: string;
  mime_type: string;
  version: number;
}

/** A field with none of the R.3 details filled in. */
const NO_DETAILS = {
  field_type: 'tea_field',
  parent_field_id: null,
  parent_field: null,
  planting_year: null,
  tea_variety_id: null,
  tea_variety: null,
  spacing: null,
  altitude: null,
  average_slope: null,
  irrigation_source_id: null,
  irrigation_source: null,
  soil_type_id: null,
  soil_type: null,
  drainage_class_id: null,
  drainage_class: null,
  created_by: { id: 'usr_manager', username: 'manager' },
  has_boundary: false,
  centroid: null,
  perimeter_km: null,
  mapped_area_acres: null,
  area_difference_pct: null,
  boundary_warning: null,
} as const;

/** The lists the Field / Block form picks from (GET /lookups/{type}), as the backend seeds them. */
export const MOCK_FIELD_LOOKUPS = {
  tea_variety: [
    { id: 'tv1', code: 'TV-1', name: 'TV-1' },
    { id: 'tv2', code: 'TV-18', name: 'TV-18' },
    { id: 'tv3', code: 'CLONE-6', name: 'Clone 6' },
  ],
  irrigation_source: [
    { id: 'ir1', code: 'RAIN_FED', name: 'Rain fed' },
    { id: 'ir2', code: 'TUBEWELL', name: 'Tube well' },
  ],
  soil_type: [
    { id: 'so1', code: 'LOAM', name: 'Loam' },
    { id: 'so2', code: 'CLAY', name: 'Clay loam' },
  ],
  drainage_class: [
    { id: 'dr1', code: 'GOOD', name: 'Good' },
    { id: 'dr2', code: 'POOR', name: 'Poor' },
  ],
} as const;

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
    tea_area: null,
    non_tea_area: null,
    division_count: null,
    section_count: null,
    field_count: null,
    worker_count: null,
    family_count: null,
  });
  const division = (id: string, estate_id: string, code: string, name: string): Division => ({
    ...base,
    id,
    estate_id,
    code,
    name,
    manager_profile_id: null,
    area: null,
    description: null,
    section_count: 0,
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
    parent_section_id: null,
    parent_section: null,
    description: null,
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
    ...NO_DETAILS,
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
      {
        ...field('f1', s1, 'A-N1-1', '12.500', '11.750'),
        name: 'Block One',
        planting_year: 1998,
        tea_variety_id: 'tv1',
        spacing: '4ft × 2.5ft',
        altitude: '240.00',
        average_slope: '5.00',
        irrigation_source_id: 'ir1',
        soil_type_id: 'so1',
        drainage_class_id: 'dr1',
      },
      { ...field('f2', s1, 'A-N1-2', '8.000', '8.000'), field_type: 'nursery' },
      field('f3', s2, 'A-N2-1', '10.250', '9.000'),
      field('f4', s4, 'B-V1-1', '15.000', '14.500'),
    ],
    sequence: 0,
    shapes: {
      f1: square(90.4, 23.7, 0.004),
      f2: square(90.41, 23.7, 0.003),
    },
    outlines: { s1: square(90.4, 23.7, 0.012) },
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
    1000,
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
const lookupOf = (type: keyof typeof MOCK_FIELD_LOOKUPS, id: string | null) =>
  MOCK_FIELD_LOOKUPS[type].find((row) => row.id === id) ?? null;

/** A field as the server answers: the objects behind its ids, worked out from them. */
const fieldOut = (f: Field): Field => {
  const parent = store.fields.find((other) => other.id === f.parent_field_id);
  const shape = store.shapes[f.id];
  return {
    ...f,
    has_boundary: shape !== undefined,
    mapped_area_acres: shape ? mappedAcres(shape) : null,
    perimeter_km: shape ? '2.150' : null,
    centroid: shape ? { latitude: '23.7020', longitude: '90.4020' } : null,
    parent_field: parent ? { id: parent.id, field_number: parent.field_number, name: parent.name } : null,
    tea_variety: lookupOf('tea_variety', f.tea_variety_id),
    irrigation_source: lookupOf('irrigation_source', f.irrigation_source_id),
    soil_type: lookupOf('soil_type', f.soil_type_id),
    drainage_class: lookupOf('drainage_class', f.drainage_class_id),
  };
};
/** A division with its "Total Section": the active sections it has. */
const divisionOut = (d: Division): Division => ({
  ...d,
  section_count: store.sections.filter((s) => s.division_id === d.id && s.status === 'active').length,
});
/** A section with the parent section behind its id. */
const sectionOut = (sec: Section): Section => {
  const parent = store.sections.find((other) => other.id === sec.parent_section_id);
  return {
    ...sec,
    parent_section: parent ? { id: parent.id, code: parent.code, name: parent.name } : null,
  };
};
/** What the server sends for one row of a hierarchy table. */
const rowOut = (path: string, row: unknown) => {
  if (path === 'fields') return fieldOut(row as Field);
  if (path === 'divisions') return divisionOut(row as Division);
  if (path === 'sections') return sectionOut(row as Section);
  return row;
};

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

/** The server's checks on the R.3 field details; null when they hold. */
function fieldProblems(body: Record<string, unknown>, ownId: string | null) {
  const problems: { field: string; code: string; message: string }[] = [];
  const year = body.planting_year;
  if (typeof year === 'number' && year > new Date().getFullYear())
    problems.push({ field: 'planting_year', code: 'NOT_FUTURE', message: 'Cannot be in the future.' });
  const parent = body.parent_field_id;
  if (typeof parent === 'string' && parent === ownId)
    problems.push({
      field: 'parent_field_id',
      code: 'CYCLE',
      message: 'A field cannot sit inside itself or one of its own blocks.',
    });
  return problems.length > 0
    ? apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', problems)
    : null;
}

/** The figures under the Division & Section and Field / Block lists, as GET /estates/{id}/summary computes them. */
function hierarchyOf(estateId: string) {
  const counts = (rows: readonly { status: string }[]) => ({
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status !== 'active').length,
  });
  const divisions = store.divisions.filter((d) => d.estate_id === estateId);
  const sections = store.sections.filter((x) => x.estate_id === estateId);
  const fields = store.fields.filter((f) => f.estate_id === estateId);
  const active = <T extends { status: string }>(rows: readonly T[]) =>
    rows.filter((r) => r.status === 'active');
  const sum = (values: readonly (string | null)[]) =>
    values.reduce<InstanceType<typeof Dec>>((total, v) => (v ? total.plus(v) : total), new Dec('0'));
  const withArea = active(sections).filter((x) => x.area !== null);
  const sectionArea = sum(active(sections).map((x) => x.area));
  const types = Object.fromEntries(
    FIELD_TYPES.map((type) => [type, active(fields).filter((f) => f.field_type === type).length]),
  );
  return {
    divisions: counts(divisions),
    sections: counts(sections),
    fields: counts(fields),
    field_types: types,
    division_area: sum(active(divisions).map((d) => d.area)).toFixed(3),
    section_area: sectionArea.toFixed(3),
    average_section_area: withArea.length > 0 ? sectionArea.div(withArea.length).toFixed(2) : null,
    field_area: sum(active(fields).map((f) => f.gross_area)).toFixed(3),
    planted_area: sum(active(fields).map((f) => f.planted_area)).toFixed(3),
  };
}

function estateProfileMocks(b: string): RequestHandler[] {
  const estate = (id: unknown) => store.estates.find((e) => e.id === id);
  const boundaryOut = (f: Field) => {
    const out = fieldOut(f);
    const shape = store.shapes[f.id] ?? null;
    return {
      field_id: f.id,
      boundary: shape,
      centroid: out.centroid,
      perimeter_km: out.perimeter_km,
      mapped_area_acres: out.mapped_area_acres,
      gross_area: f.gross_area,
      area_difference_pct: shape ? '4.2' : null,
      boundary_warning: null,
      version: f.version,
    };
  };
  return [
    http.get(`${b}/estates/:id/map`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = estate(params.id);
      if (!row) return notFound();
      const fields = store.fields.filter((f) => f.estate_id === row.id);
      const features = [
        ...store.sections
          .filter((section) => section.estate_id === row.id && store.outlines[section.id])
          .map((section) => ({
            id: `section-${section.id}`,
            type: 'Feature',
            geometry: store.outlines[section.id],
            properties: { layer: 'section', id: section.id, name: section.name },
          })),
        ...fields
          .filter((f) => store.shapes[f.id])
          .map((f) => ({
            id: `field-${f.id}`,
            type: 'Feature',
            geometry: store.shapes[f.id],
            properties: {
              layer: f.field_type === 'drain' ? 'drain' : 'field',
              id: f.id,
              code: f.field_number,
              name: f.name,
              field_type: f.field_type,
              field_status: f.field_status,
              status: f.status,
              gross_area: f.gross_area,
              planted_area: f.planted_area,
              section_name: store.sections.find((section) => section.id === f.section_id)?.name ?? '',
              division_name: store.divisions.find((d) => d.id === f.division_id)?.name ?? '',
            },
          })),
      ];
      return ok({
        estate: {
          id: row.id,
          code: row.code,
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
        },
        bbox: features.length > 0 ? [90.4, 23.7, 90.413, 23.712] : null,
        features,
        unmapped_field_ids: fields.filter((f) => !store.shapes[f.id]).map((f) => f.id),
      });
    }),
    http.get(`${b}/fields/:id/boundary`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const f = store.fields.find((x) => x.id === params.id);
      return f ? ok(boundaryOut(f), { version: f.version }) : notFound();
    }),
    http.put(`${b}/fields/:id/boundary`, async ({ request, params }) => {
      const f = store.fields.find((x) => x.id === params.id);
      if (!f) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, f.version);
      if (refused) return refused;
      const body = (await request.json()) as {
        boundary?: Geometry | null;
        kml?: string;
        points?: { latitude: number; longitude: number }[];
      };
      if (body.kml !== undefined && !body.kml.includes('<coordinates>'))
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'kml', code: 'INVALID', message: 'The file has no shape in it.' },
        ]);
      if (body.points?.some((point) => point.longitude < 88 || point.longitude > 93))
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          {
            field: 'points',
            code: 'OUTSIDE_COUNTRY',
            message: 'A point is outside Bangladesh (check latitude / longitude order).',
          },
        ]);
      const shape: Geometry | null =
        body.boundary !== undefined
          ? body.boundary
          : body.points
            ? {
                type: 'Polygon',
                coordinates: [
                  [
                    ...body.points.map((point) => [point.longitude, point.latitude]),
                    [body.points[0]?.longitude ?? 0, body.points[0]?.latitude ?? 0],
                  ],
                ],
              }
            : square(90.4, 23.7, 0.002);
      if (shape) store.shapes[f.id] = shape;
      else store.shapes = Object.fromEntries(Object.entries(store.shapes).filter(([id]) => id !== f.id));
      f.version += 1;
      return ok(boundaryOut(f), { version: f.version });
    }),
    http.get(`${b}/estates/:id/summary`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = estate(params.id);
      if (!row) return notFound();
      const fields = store.fields.filter((f) => f.estate_id === row.id && f.status === 'active');
      const tea = fields.reduce((sum, f) => sum.plus(f.planted_area ?? '0'), new Dec('0'));
      const gross = fields.reduce((sum, f) => sum.plus(f.gross_area), new Dec('0'));
      const divisions = store.divisions.filter((d) => d.estate_id === row.id);
      const computedCounts = {
        division_count: divisions.length,
        section_count: store.sections.filter((s) => divisions.some((d) => d.id === s.division_id)).length,
        field_count: fields.length,
        worker_count: null,
        family_count: null,
      };
      const computedNonTea = row.total_area
        ? Dec.max(new Dec(row.total_area).minus(row.tea_area ?? tea), new Dec('0')).toFixed(3)
        : null;
      const entered = (key: keyof typeof computedCounts) => row[key];
      const pick = (key: keyof typeof computedCounts) => entered(key) ?? computedCounts[key] ?? 0;
      const source = (value: unknown) => (value === null ? 'computed' : 'entered');
      return ok({
        estate_id: row.id,
        total_land_area: row.total_area,
        tea_area: row.tea_area ?? tea.toFixed(3),
        non_tea_area: row.non_tea_area ?? computedNonTea,
        field_area: gross.toFixed(3),
        division_count: pick('division_count'),
        section_count: pick('section_count'),
        field_count: pick('field_count'),
        factory_count: store.factories.filter((f) => f.primary_estate_id === row.id).length,
        worker_count: pick('worker_count'),
        family_count: pick('family_count'),
        workforce_available: false,
        photo_count: store.photos.filter((p) => p.owner_id === row.id).length,
        hierarchy: hierarchyOf(row.id),
        source: {
          tea_area: source(row.tea_area),
          non_tea_area: source(row.non_tea_area),
          division_count: source(row.division_count),
          section_count: source(row.section_count),
          field_count: source(row.field_count),
          worker_count: source(row.worker_count),
          family_count: source(row.family_count),
        },
        computed: {
          tea_area: tea.toFixed(3),
          non_tea_area: computedNonTea,
          ...computedCounts,
        },
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
        tea_area: null,
        non_tea_area: null,
        division_count: null,
        section_count: null,
        field_count: null,
        worker_count: null,
        family_count: null,
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
        scopedPage(request, store.divisions.filter((d) => d.estate_id === params.id).map(divisionOut)),
    ),
    http.post(`${b}/estates/:id/divisions`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const estate = store.estates.find((e) => e.id === params.id);
      if (!estate) return notFound();
      if (estate.status !== 'active') return inactiveParent('estate_id', 'estate');
      const body = (await request.json()) as {
        code: string;
        name: string;
        area: string | null;
        description?: string | null;
      };
      if (store.divisions.some((d) => d.estate_id === estate.id && d.code === body.code)) {
        return duplicate('code', 'A division with this code already exists in this estate.');
      }
      const division: Division = {
        ...base,
        id: nextId('d'),
        estate_id: estate.id,
        manager_profile_id: null,
        description: null,
        section_count: 0,
        ...body,
      };
      store.divisions.push(division);
      return created(divisionOut(division), `${b}/divisions/${division.id}`, division.version);
    }),
    http.get(
      `${b}/divisions/:id/sections`,
      ({ request, params }) =>
        requireAuth(request) ??
        scopedPage(request, store.sections.filter((s) => s.division_id === params.id).map(sectionOut)),
    ),
    // Every section of an estate in one request (R.3).
    http.get(
      `${b}/sections`,
      ({ request }) =>
        requireAuth(request) ??
        scopedPage(request, store.sections.filter((s) => visible(s.estate_id)).map(sectionOut)),
    ),
    http.post(`${b}/divisions/:id/sections`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const division = store.divisions.find((d) => d.id === params.id);
      if (!division) return notFound();
      if (division.status !== 'active') return inactiveParent('division_id', 'division');
      const body = (await request.json()) as {
        code: string;
        name: string;
        area: string | null;
        description?: string | null;
        parent_section_id?: string | null;
      };
      if (store.sections.some((s) => s.division_id === division.id && s.code === body.code)) {
        return duplicate('code', 'A section with this code already exists in this division.');
      }
      const section: Section = {
        ...base,
        id: nextId('s'),
        division_id: division.id,
        estate_id: division.estate_id,
        supervisor_profile_id: null,
        parent_section_id: null,
        parent_section: null,
        description: null,
        ...body,
      };
      store.sections.push(section);
      return created(sectionOut(section), `${b}/sections/${section.id}`, section.version);
    }),

    // ---- Fields ----
    http.get(
      `${b}/fields`,
      ({ request }) =>
        requireAuth(request) ??
        scopedPage(request, store.fields.filter((f) => visible(f.estate_id)).map(fieldOut)),
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
      const detailProblems = fieldProblems(body, null);
      if (detailProblems) return detailProblems;
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
        ...NO_DETAILS,
        ...body,
        created_at: new Date().toISOString(),
      };
      store.fields.push(field);
      return created(fieldOut(field), `${b}/fields/${field.id}`, field.version);
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
        return row ? ok(rowOut(path, row), { version: row.version }) : notFound();
      }),
      ...(['put', 'patch'] as const).map((method) =>
        http[method](`${b}/${path}/:id`, async ({ request, params }) => {
          const row = (tables()[path] as Record<string, unknown>[]).find((r) => r.id === params.id) as
            { id: string; version: number; updated_at: string | null; gross_area?: string } | undefined;
          if (!row) return notFound();
          const refused = requireAuth(request) ?? requireIfMatch(request, row.version);
          if (refused) return refused;
          const body = (await request.json()) as Record<string, unknown>;
          if (path === 'estates') {
            const merged = { ...row, ...body } as unknown as Estate;
            const total = merged.total_area;
            const over = (value: string | null, field: string, message: string) =>
              total !== null && value !== null && new Dec(value).gt(total)
                ? [{ field, code: 'TOO_LARGE', message }]
                : [];
            const problems = [
              ...over(merged.tea_area, 'tea_area', 'Cannot be more than the total land area.'),
              ...over(merged.non_tea_area, 'non_tea_area', 'Cannot be more than the total land area.'),
              ...(total !== null &&
              merged.tea_area !== null &&
              merged.non_tea_area !== null &&
              new Dec(merged.tea_area).plus(merged.non_tea_area).gt(total)
                ? [
                    {
                      field: 'non_tea_area',
                      code: 'TOO_LARGE',
                      message: 'Tea and non-tea area together cannot be more than the total.',
                    },
                  ]
                : []),
            ];
            if (problems.length > 0)
              return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', problems);
          }
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
          if (path === 'fields') {
            const problems = fieldProblems(body, row.id);
            if (problems) return problems;
          }
          Object.assign(row, path === 'estates' ? withAmenities(body) : body);
          return ok(rowOut(path, touch(row)), { version: row.version });
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
        return ok(rowOut(path, touch(row)), { version: row.version });
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
