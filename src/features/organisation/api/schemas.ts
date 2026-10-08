import { z } from 'zod';

/**
 * The organisation hierarchy (P1.07, backend organisation.schema.ts): organisation → estate → division →
 * section → field. Areas are hectares as decimal strings with 3 places ("12.500"); dates are YYYY-MM-DD.
 */

export const STATUSES = ['active', 'inactive'] as const;
export type NodeStatus = (typeof STATUSES)[number];
export const OWNERSHIP_TYPES = ['owned', 'leased', 'government_lease', 'other'] as const;
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
  established_on: z.string().nullable(),
  ownership_type: z.enum(OWNERSHIP_TYPES).nullable(),
  status: z.enum(STATUSES),
  remarks: z.string().nullable(),
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
  status: z.enum(STATUSES),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Section = z.infer<typeof SectionSchema>;

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
  contact_type: z.enum(CONTACT_TYPES),
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
