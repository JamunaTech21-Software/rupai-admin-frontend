import { type LookupType } from '@/lib/lookups';
import { type DecimalKind } from '@/lib/money';

/**
 * Every reference master (P1.10), described once, mirroring the backend's descriptors
 * (backend/src/modules/lookups/lookup-types.ts). One screen (MasterScreen) turns a descriptor into the list, its
 * filters and the add / edit form, so the 25 masters look and behave the same.
 *
 * Adding a master: add its descriptor here and its words to the `ref` translations (types, and any new field).
 */

export type MasterFieldType =
  | {
      readonly kind: 'text';
      readonly max: number;
      readonly pattern?: RegExp;
      readonly isLong?: boolean;
      /** The server stores it in upper case (currency code, ISO codes). */
      readonly isUpper?: boolean;
    }
  | { readonly kind: 'int'; readonly min: number; readonly max: number }
  | { readonly kind: 'bool' }
  | { readonly kind: 'decimal'; readonly decimal: DecimalKind; readonly isPositive?: boolean }
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  /** The id of a row of another master, or of an estate. */
  | { readonly kind: 'ref'; readonly to: RefTarget }
  /** A time of day, "HH:MM". */
  | { readonly kind: 'time' };

export type RefTarget = LookupType | 'estate';

export type MasterFieldName =
  | 'code'
  | 'name'
  | 'description'
  | 'sort_order'
  | 'manufacture_process'
  | 'tea_type_id'
  | 'grade_category'
  | 'is_primary_grade'
  | 'cost_category'
  | 'default_uom_id'
  | 'requires_material'
  | 'estate_id'
  | 'start_time'
  | 'end_time'
  | 'break_minutes'
  | 'grace_minutes'
  | 'half_day_hours'
  | 'is_overnight'
  | 'overtime_after_minutes'
  | 'base_uom_id'
  | 'variety_type'
  | 'recommended_spacing'
  | 'typical_yield_kg_ha'
  | 'uom_category_id'
  | 'decimal_precision'
  | 'conversion_factor'
  | 'symbol'
  | 'decimal_places'
  | 'iso2'
  | 'iso3'
  | 'dialling_code';

export interface MasterField {
  readonly name: MasterFieldName;
  readonly type: MasterFieldType;
  /** Must be given and is never empty. */
  readonly isRequired?: boolean;
  /** Sent when the input is left empty. Absent: the field is nullable and empty means null. */
  readonly fallback?: number;
  /** Shown in the list, never in the form: the server maintains it (is_overnight, a category's base unit). */
  readonly isReadOnly?: boolean;
  /** A column of the list; 'optional' columns start hidden and are shown from the Columns menu. */
  readonly isColumn?: boolean | 'optional';
  /** A filter of the list; a string names the API filter when it differs from the field. */
  readonly filter?: true | string;
  /** What an empty reference means, when that is something ("every tea type"). */
  readonly emptyMeans?: 'allTeaTypes' | 'allEstates';
}

export type MasterGroup = 'people' | 'tea' | 'field' | 'trade' | 'stock' | 'general';

export interface MasterType {
  readonly key: LookupType;
  /** Path under /api/v1. */
  readonly path: string;
  /** The permission module: {module}.view / .create / .edit / .delete. */
  readonly permission: string;
  /** Where its list lives in the app. */
  readonly href: string;
  readonly group: MasterGroup;
  /** The unique business key: code, or iso2 for a country. */
  readonly keyField: 'code' | 'iso2';
  /** Rows may be system records: they keep their key and are never deleted or deactivated. */
  readonly hasSystem: boolean;
  /** Rows may be the base of something (base unit, base currency): never deleted or deactivated. */
  readonly hasBase?: boolean;
  readonly fields: readonly MasterField[];
  /** The list's sort when the URL has none. */
  readonly defaultSort: string;
}

const CODE = /^[A-Za-z0-9][A-Za-z0-9_.\-/]*$/;

const CODE_FIELD: MasterField = {
  name: 'code',
  type: { kind: 'text', max: 20, pattern: CODE },
  isRequired: true,
};
const NAME_FIELD: MasterField = { name: 'name', type: { kind: 'text', max: 150 }, isRequired: true };

/** P3 §5.1: code, name, description and sort order. */
const COMMON: readonly MasterField[] = [
  CODE_FIELD,
  NAME_FIELD,
  { name: 'sort_order', type: { kind: 'int', min: 0, max: 100000 }, fallback: 0 },
  { name: 'description', type: { kind: 'text', max: 500, isLong: true } },
];

const slug = (key: string) => key.replaceAll('_', '-');

function common(
  key: LookupType,
  group: MasterGroup,
  extra: readonly MasterField[] = [],
  over: Partial<MasterType> = {},
): MasterType {
  return {
    key,
    path: `/lookups/${key}`,
    permission: 'lookup',
    href: `/masters/${slug(key)}`,
    group,
    keyField: 'code',
    hasSystem: true,
    // Code and name first, then the type's own fields, then sort order and description.
    fields: [...COMMON.slice(0, 2), ...extra, ...COMMON.slice(2)],
    defaultSort: 'sort_order,name',
    ...over,
  };
}

export const MANUFACTURE_PROCESSES = ['ctc', 'orthodox', 'green', 'oolong', 'white', 'other'] as const;
export const GRADE_CATEGORIES = ['leaf', 'broken', 'fannings', 'dust'] as const;
export const COST_CATEGORIES = ['cultivation', 'maintenance', 'protection', 'harvesting', 'other'] as const;
export const VARIETY_TYPES = ['clonal', 'seedling', 'hybrid'] as const;

export const MASTER_TYPES: readonly MasterType[] = [
  // ---- People ----
  common('department', 'people'),
  common('designation', 'people'),
  common('worker_category', 'people'),
  common('employee_category', 'people'),
  common('employment_type', 'people'),
  common('leave_type', 'people'),
  common(
    'shift',
    'people',
    [
      {
        name: 'estate_id',
        type: { kind: 'ref', to: 'estate' },
        isColumn: true,
        filter: true,
        emptyMeans: 'allEstates',
      },
      { name: 'start_time', type: { kind: 'time' }, isRequired: true, isColumn: true },
      { name: 'end_time', type: { kind: 'time' }, isRequired: true, isColumn: true },
      { name: 'is_overnight', type: { kind: 'bool' }, isReadOnly: true, isColumn: true },
      { name: 'break_minutes', type: { kind: 'int', min: 0, max: 1440 }, fallback: 0 },
      { name: 'grace_minutes', type: { kind: 'int', min: 0, max: 1440 }, fallback: 0 },
      { name: 'half_day_hours', type: { kind: 'decimal', decimal: 'pct', isPositive: true } },
      { name: 'overtime_after_minutes', type: { kind: 'int', min: 0, max: 1440 } },
    ],
    { path: '/shifts', permission: 'shift' },
  ),

  // ---- Tea ----
  common(
    'tea_type',
    'tea',
    [
      {
        name: 'manufacture_process',
        type: { kind: 'enum', values: MANUFACTURE_PROCESSES },
        isColumn: true,
        filter: true,
      },
    ],
    { path: '/tea-types', permission: 'tea_type' },
  ),
  common(
    'tea_grade',
    'tea',
    [
      {
        name: 'tea_type_id',
        type: { kind: 'ref', to: 'tea_type' },
        isColumn: true,
        // The grades that may be chosen for a tea type: its own and the universal ones.
        filter: 'valid_for_tea_type_id',
        emptyMeans: 'allTeaTypes',
      },
      {
        name: 'grade_category',
        type: { kind: 'enum', values: GRADE_CATEGORIES },
        isColumn: true,
        filter: true,
      },
      { name: 'is_primary_grade', type: { kind: 'bool' }, isColumn: true, filter: true },
    ],
    { path: '/tea-grades', permission: 'tea_grade', href: '/tea-grades' },
  ),
  common('quality_grade', 'tea'),
  common('tea_variety', 'tea', [
    { name: 'variety_type', type: { kind: 'enum', values: VARIETY_TYPES }, isColumn: true, filter: true },
    { name: 'recommended_spacing', type: { kind: 'text', max: 100 } },
    { name: 'typical_yield_kg_ha', type: { kind: 'decimal', decimal: 'qty' }, isColumn: true },
  ]),

  // ---- Field work and land ----
  common(
    'activity_type',
    'field',
    [
      {
        name: 'cost_category',
        type: { kind: 'enum', values: COST_CATEGORIES },
        isRequired: true,
        isColumn: true,
        filter: true,
      },
      { name: 'default_uom_id', type: { kind: 'ref', to: 'uom' }, isColumn: 'optional' },
      { name: 'requires_material', type: { kind: 'bool' }, isColumn: true, filter: true },
    ],
    { permission: 'activity_type' },
  ),
  common('land_type', 'field'),
  common('collection_point_type', 'field'),
  common('amenity', 'field'),

  // ---- Trade ----
  common('buyer_type', 'trade'),
  common('trading_type', 'trade'),
  common('packaging_type', 'trade'),
  common('charge_type', 'trade'),
  common('payment_method', 'trade'),

  // ---- Stock and units ----
  {
    key: 'uom',
    path: '/uoms',
    permission: 'uom',
    href: '/uoms',
    group: 'stock',
    keyField: 'code',
    hasSystem: true,
    hasBase: true,
    defaultSort: 'code',
    fields: [
      CODE_FIELD,
      { name: 'name', type: { kind: 'text', max: 100 }, isRequired: true },
      {
        name: 'uom_category_id',
        type: { kind: 'ref', to: 'uom_category' },
        isRequired: true,
        isColumn: true,
        filter: true,
      },
      { name: 'decimal_precision', type: { kind: 'int', min: 0, max: 6 }, fallback: 3, isColumn: true },
      {
        name: 'conversion_factor',
        type: { kind: 'decimal', decimal: 'pct', isPositive: true },
        isColumn: true,
      },
    ],
  },
  common(
    'uom_category',
    'stock',
    [{ name: 'base_uom_id', type: { kind: 'ref', to: 'uom' }, isReadOnly: true, isColumn: true }],
    {
      permission: 'uom',
    },
  ),
  common('adjustment_reason', 'stock'),

  // ---- General ----
  common('document_type', 'general'),
  {
    key: 'currency',
    path: '/lookups/currency',
    permission: 'currency',
    href: '/masters/currency',
    group: 'general',
    keyField: 'code',
    hasSystem: false,
    hasBase: true,
    defaultSort: 'code',
    fields: [
      {
        name: 'code',
        type: { kind: 'text', max: 3, pattern: /^[A-Za-z]{3}$/, isUpper: true },
        isRequired: true,
      },
      NAME_FIELD,
      { name: 'symbol', type: { kind: 'text', max: 10 }, isColumn: true },
      { name: 'decimal_places', type: { kind: 'int', min: 0, max: 4 }, fallback: 2, isColumn: true },
    ],
  },
  {
    key: 'country',
    path: '/lookups/country',
    permission: 'country',
    href: '/masters/country',
    group: 'general',
    keyField: 'iso2',
    hasSystem: false,
    defaultSort: 'name',
    fields: [
      {
        name: 'iso2',
        type: { kind: 'text', max: 2, pattern: /^[A-Za-z]{2}$/, isUpper: true },
        isRequired: true,
      },
      NAME_FIELD,
      {
        name: 'iso3',
        type: { kind: 'text', max: 3, pattern: /^[A-Za-z]{3}$/, isUpper: true },
        isRequired: true,
        isColumn: true,
      },
      {
        name: 'dialling_code',
        type: { kind: 'text', max: 10, pattern: /^\+[0-9][0-9 -]{0,8}$/ },
        isColumn: true,
      },
    ],
  },
];

export const MASTER_GROUPS: readonly MasterGroup[] = ['people', 'tea', 'field', 'trade', 'stock', 'general'];

const BY_KEY = new Map(MASTER_TYPES.map((type) => [type.key, type]));

export function masterType(key: LookupType): MasterType {
  const type = BY_KEY.get(key);
  if (!type) throw new Error(`unknown master ${key}`);
  return type;
}

/** The master whose list is at /masters/{slug}, if any (units and tea grades have pages of their own). */
export function masterBySlug(value: string | undefined): MasterType | undefined {
  return MASTER_TYPES.find((type) => type.href === `/masters/${value ?? ''}`);
}
