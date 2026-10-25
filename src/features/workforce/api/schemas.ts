import { z } from 'zod';

/**
 * The person registry as the API sends it (P2.01): identity only. Employment (department, designation, wage,
 * joining date) belongs to the employment profile (P2.02) and is never part of a person.
 */

export const STATUSES = ['active', 'inactive'] as const;
export const TITLES = ['mr', 'mrs', 'ms', 'other'] as const;
export const GENDERS = ['male', 'female', 'other'] as const;
export const MARITAL_STATUSES = ['single', 'married', 'widowed', 'divorced'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const PAYMENT_METHODS = ['bank', 'cash', 'mobile_banking'] as const;
export const MOBILE_BANKING = ['bkash', 'nagad', 'rocket', 'upay', 'other'] as const;
export const RELATIONS = [
  'father',
  'mother',
  'spouse',
  'son',
  'daughter',
  'brother',
  'sister',
  'other',
] as const;

const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });
const Text = z.string().nullable();

export const PersonSchema = z.looseObject({
  id: z.string(),
  person_code: z.string(),
  registered_estate_id: Text,
  title: z.enum(TITLES).nullable(),
  first_name: z.string(),
  middle_name: Text,
  last_name: Text,
  full_name: z.string(),
  father_name: Text,
  mother_name: Text,
  spouse_name: Text,
  date_of_birth: Text,
  age: z.number().int().nullable(),
  gender: z.enum(GENDERS).nullable(),
  marital_status: z.enum(MARITAL_STATUSES).nullable(),
  blood_group: z.enum(BLOOD_GROUPS).nullable(),
  nationality_country_id: Text,
  nationality: z.looseObject({ id: z.string(), name: z.string() }).nullable(),
  religion_id: Text,
  religion: Ref.nullable(),
  national_id: Text,
  birth_certificate_no: Text,
  passport_no: Text,
  driving_license_no: Text,
  tin: Text,
  phone: Text,
  alternate_phone: Text,
  personal_email: Text,
  present_address: Text,
  present_district: Text,
  present_upazila: Text,
  present_postal_code: Text,
  permanent_address: Text,
  permanent_district: Text,
  permanent_upazila: Text,
  permanent_postal_code: Text,
  education_level_id: Text,
  education_level: Ref.nullable(),
  skills: z.array(Ref),
  languages: z.array(Ref),
  experience_years: z.number().int().nullable(),
  emergency_contact_name: Text,
  emergency_contact_phone: Text,
  emergency_contact_alt_phone: Text,
  emergency_contact_relation: z.enum(RELATIONS).nullable(),
  emergency_contact_address: Text,
  payment_method: z.enum(PAYMENT_METHODS).nullable(),
  bank_name: Text,
  bank_branch: Text,
  bank_account_number: Text,
  mobile_banking_provider: z.enum(MOBILE_BANKING).nullable(),
  mobile_banking_number: Text,
  remarks: Text,
  dependent_count: z.number().int(),
  status: z.enum(STATUSES),
  created_by: z.looseObject({ id: z.string(), username: z.string() }),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: Text,
});
export type Person = z.infer<typeof PersonSchema>;
export type PersonStatus = (typeof STATUSES)[number];

export const DependentSchema = z.looseObject({
  id: z.string(),
  person_id: z.string(),
  name: z.string(),
  relation: z.enum(RELATIONS),
  occupation: Text,
  date_of_birth: Text,
  age: z.number().int().nullable(),
  gender: z.enum(GENDERS).nullable(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: Text,
});
export type Dependent = z.infer<typeof DependentSchema>;
