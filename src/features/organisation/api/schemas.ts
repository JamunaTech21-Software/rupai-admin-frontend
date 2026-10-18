import { z } from 'zod';

/**
 * The organisation hierarchy (P1.07, backend organisation.schema.ts): organisation → estate → division →
 * section → field. Areas are acres (R.2) as decimal strings with 3 places ("12.500"); dates are YYYY-MM-DD.
 */

export const STATUSES = ['active', 'inactive'] as const;
export type NodeStatus = (typeof STATUSES)[number];
export const OWNERSHIP_TYPES = ['owned', 'leased', 'government_lease', 'other'] as const;
/** R.2: replaces ownership_type. */
export const ESTATE_TYPES = ['company_owned', 'private_estate', 'government_estate'] as const;
export type EstateType = (typeof ESTATE_TYPES)[number];
export const ESTATE_CATEGORIES = ['large', 'medium', 'small'] as const;
export type EstateCategory = (typeof ESTATE_CATEGORIES)[number];
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];
export const FIELD_STATUSES = ['producing', 'young', 'nursery', 'uprooted', 'fallow', 'abandoned'] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

/** Codes as the backend accepts them: letters, digits and . _ - /, 1–20 characters. */
export const NODE_CODE = /^[A-Za-z0-9][A-Za-z0-9_.\-/]{0,19}$/;
/** Phone numbers as the backend accepts them, e.g. +8801711000000. */
export const PHONE = /^\+?[0-9][0-9 -]{4,26}[0-9]$/;

export const OrganisationSchema = z.object({
  id: z.string(),
  name: z.string(),
  short_name: z.string(),
  registration_number: z.string().nullable(),
  tin: z.string().nullable(),
  vat_registration: z.string().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  postal_code: z.string().nullable(),
  country_id: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  logo_path: z.string().nullable(),
  base_currency_id: z.string().nullable(),
  fiscal_year_start_month: z.number(),
  status: z.enum(STATUSES),
  version: z.number(),
  updated_at: z.string().nullable(),
});
export type Organisation = z.infer<typeof OrganisationSchema>;

export const EstateSchema = z.object({
  id: z.string(),
  organisation_id: z.string(),
  code: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  address_line1: z.string().nullable(),
  district: z.string().nullable(),
  total_area: z.string().nullable(),
  manager_profile_id: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  /** Deprecated (R.2): established_year and estate_type replace them. */
  established_on: z.string().nullable(),
  ownership_type: z.enum(OWNERSHIP_TYPES).nullable(),
  status: z.enum(STATUSES),
  remarks: z.string().nullable(),
  // ---- R.2 estate profile ----
  established_year: z.number().int().nullable(),
  owner_name: z.string().nullable(),
  estate_type: z.enum(ESTATE_TYPES).nullable(),
  estate_category: z.enum(ESTATE_CATEGORIES).nullable(),
  police_station: z.string().nullable(),
  /** The administrative division (e.g. Rangpur), not the estate's own divisions. */
  admin_division: z.string().nullable(),
  country_id: z.string().nullable(),
  postal_code: z.string().nullable(),
  website: z.string().nullable(),
  /** Decimal degrees as strings, up to 6 places: "26.341700". Both or neither. */
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  description: z.string().nullable(),
  amenities: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })),
  other_amenities: z.string().nullable(),
  /** Entered overview figures, acres and counts; null: not entered, the computed one is shown (R.2). */
  tea_area: z.string().nullable(),
  non_tea_area: z.string().nullable(),
  division_count: z.number().int().nullable(),
  section_count: z.number().int().nullable(),
  field_count: z.number().int().nullable(),
  worker_count: z.number().int().nullable(),
  family_count: z.number().int().nullable(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Estate = z.infer<typeof EstateSchema>;

export const DivisionSchema = z.object({
  id: z.string(),
  estate_id: z.string(),
  code: z.string(),
  name: z.string(),
  manager_profile_id: z.string().nullable(),
  area: z.string().nullable(),
  description: z.string().nullable(),
  /** Active sections of the division ("Total Section"). */
  section_count: z.number().int(),
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Division = z.infer<typeof DivisionSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  division_id: z.string(),
  estate_id: z.string(),
  code: z.string(),
  name: z.string(),
  supervisor_profile_id: z.string().nullable(),
  area: z.string().nullable(),
  /** Another section of the same division ("Parent Section"). */
  parent_section_id: z.string().nullable(),
  parent_section: z.object({ id: z.string(), code: z.string(), name: z.string().nullable() }).nullable(),
  description: z.string().nullable(),
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Section = z.infer<typeof SectionSchema>;

export const FIELD_TYPES = [
  'tea_field',
  'nursery',
  'extension',
  'infrastructure',
  'drain',
  'road_reserve',
  'shade_area',
  'road_side',
  'water_body',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const LookupRef = z.object({ id: z.string(), code: z.string(), name: z.string() });

export const FieldSchema = z.object({
  id: z.string(),
  estate_id: z.string(),
  division_id: z.string(),
  section_id: z.string(),
  field_number: z.string(),
  name: z.string().nullable(),
  gross_area: z.string(),
  planted_area: z.string().nullable(),
  field_status: z.enum(FIELD_STATUSES),
  section_effective_from: z.string().nullable(),
  status: z.enum(STATUSES),
  remarks: z.string().nullable(),
  field_type: z.enum(FIELD_TYPES),
  parent_field_id: z.string().nullable(),
  parent_field: z
    .object({ id: z.string(), field_number: z.string(), name: z.string().nullable() })
    .nullable(),
  planting_year: z.number().int().nullable(),
  tea_variety_id: z.string().nullable(),
  tea_variety: LookupRef.nullable(),
  spacing: z.string().nullable(),
  /** Feet above sea level, two places. */
  altitude: z.string().nullable(),
  /** Degrees, two places. */
  average_slope: z.string().nullable(),
  irrigation_source_id: z.string().nullable(),
  irrigation_source: LookupRef.nullable(),
  soil_type_id: z.string().nullable(),
  soil_type: LookupRef.nullable(),
  drainage_class_id: z.string().nullable(),
  drainage_class: LookupRef.nullable(),
  /** Who added the field ("Created By"). */
  created_by: z.object({ id: z.string(), username: z.string() }),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Field = z.infer<typeof FieldSchema>;

/** `meta.applied_scope` on estate and field lists: the data scope the rows were filtered by. */
export interface AppliedScope {
  readonly all_estates?: boolean;
  readonly estates?: readonly string[];
  readonly divisions?: readonly string[];
  readonly sections?: readonly string[];
}

// ---- Facilities, parties and contacts (P1.08, backend facilities.schema.ts) ----

export const FACTORY_TYPES = ['own', 'external'] as const;
export type FactoryType = (typeof FACTORY_TYPES)[number];
export const WAREHOUSE_TYPES = ['own', 'rented', 'third_party'] as const;
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];
export const PARTY_TYPES = ['individual', 'organisation', 'government'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];
export const CONTACT_TYPES = ['primary', 'accounts', 'operations', 'emergency', 'other'] as const;
/** An estate's key people (R.2), set on the estate profile rather than in a contacts list. */
export const KEY_CONTACT_TYPES = ['estate_manager', 'assistant_manager'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const FactorySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  factory_type: z.enum(FACTORY_TYPES),
  primary_estate_id: z.string().nullable(),
  location: z.string().nullable(),
  daily_capacity_kg: z.string().nullable(),
  manager_profile_id: z.string().nullable(),
  licence_number: z.string().nullable(),
  licence_expiry: z.string().nullable(),
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Factory = z.infer<typeof FactorySchema>;

export const WarehouseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  warehouse_type: z.enum(WAREHOUSE_TYPES),
  location: z.string().nullable(),
  capacity_kg: z.string().nullable(),
  keeper_profile_id: z.string().nullable(),
  /** The primary contact's phone: read-only here, maintained from the contacts. */
  phone: z.string().nullable(),
  licence_number: z.string().nullable(),
  licence_expiry: z.string().nullable(),
  tin: z.string().nullable(),
  vat_registration: z.string().nullable(),
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Warehouse = z.infer<typeof WarehouseSchema>;

export const PartySchema = z.object({
  id: z.string(),
  party_type: z.enum(PARTY_TYPES),
  code: z.string(),
  name: z.string(),
  national_id: z.string().nullable(),
  registration_number: z.string().nullable(),
  address_line1: z.string().nullable(),
  district: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Party = z.infer<typeof PartySchema>;

export const ContactSchema = z.object({
  id: z.string(),
  owner_type: z.string(),
  owner_id: z.string(),
  contact_name: z.string(),
  designation: z.string().nullable(),
  contact_type: z.enum([...CONTACT_TYPES, ...KEY_CONTACT_TYPES]),
  phone: z.string().nullable(),
  phone_alt: z.string().nullable(),
  email: z.string().nullable(),
  is_primary: z.boolean(),
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Contact = z.infer<typeof ContactSchema>;

// ---- Calendars (P1.09): seasons, fiscal years, accounting periods ---------------------------------------

export const SEASON_STATES = ['planned', 'active', 'closed'] as const;
export type SeasonState = (typeof SEASON_STATES)[number];
export const FISCAL_YEAR_STATES = ['future', 'open', 'closed'] as const;
export type FiscalYearState = (typeof FISCAL_YEAR_STATES)[number];
/** soft_closed, closed and reopened are reached with period close (P10.02). */
export const PERIOD_STATES = ['future', 'open', 'soft_closed', 'closed', 'reopened'] as const;
export type PeriodState = (typeof PERIOD_STATES)[number];

export const SeasonSchema = z.object({
  id: z.string(),
  estate_id: z.string(),
  code: z.string(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  state: z.enum(SEASON_STATES),
  closed_at: z.string().nullable(),
  closed_by: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Season = z.infer<typeof SeasonSchema>;

export const FiscalYearSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  state: z.enum(FISCAL_YEAR_STATES),
  /** 0 until the periods are generated, then 13. */
  period_count: z.number(),
  closed_at: z.string().nullable(),
  closed_by: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type FiscalYear = z.infer<typeof FiscalYearSchema>;

export const AccountingPeriodSchema = z.object({
  id: z.string(),
  fiscal_year_id: z.string(),
  period_number: z.number(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  state: z.enum(PERIOD_STATES),
  /** Period 13: year-end adjustments (the last day of the year). */
  is_adjustment: z.boolean(),
  closed_at: z.string().nullable(),
  closed_by: z.string().nullable(),
  reopened_at: z.string().nullable(),
  reopened_by: z.string().nullable(),
  reopen_reason: z.string().nullable(),
  version: z.number(),
  updated_at: z.string().nullable(),
});
export type AccountingPeriod = z.infer<typeof AccountingPeriodSchema>;
