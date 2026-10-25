import { z } from 'zod';

import { GENDERS, RELATIONS } from './schemas';

/**
 * Employment profiles (P2.02): a person's employment at an estate, as a worker or an employee. The department,
 * designation, section, job and wage belong to the assignment (P2.03) and arrive read-only as `current_assignment`.
 */

export const EMPLOYMENT_TYPES = ['worker', 'employee'] as const;
export const ENGAGEMENT_TYPES = [
  'permanent',
  'temporary',
  'seasonal',
  'casual',
  'probation',
  'contractual',
] as const;
export const EMPLOYMENT_BASES = ['full_time', 'part_time'] as const;
export const JOB_NATURES = [
  'field',
  'factory',
  'office',
  'technical',
  'supervisory',
  'administrative',
  'operational',
] as const;
export const WORKING_LOCATIONS = [
  'field',
  'factory',
  'office',
  'warehouse',
  'nursery',
  'head_office',
] as const;
export const PROFILE_STATUSES = ['active', 'suspended', 'on_leave', 'separated'] as const;
export const SEPARATION_TYPES = [
  'resignation',
  'retirement',
  'termination',
  'death',
  'end_of_contract',
] as const;

const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });
const Text = z.string().nullable();

export const ProfileSchema = z.looseObject({
  id: z.string(),
  person_id: z.string(),
  person: z.looseObject({
    id: z.string(),
    person_code: z.string(),
    full_name: z.string(),
    father_name: Text,
    phone: Text,
    gender: z.enum(GENDERS).nullable(),
    date_of_birth: Text,
    national_id: Text,
    photo_document_id: Text,
  }),
  estate_id: z.string(),
  estate: z.looseObject({ id: z.string(), code: z.string(), name: z.string() }),
  employment_type: z.enum(EMPLOYMENT_TYPES),
  profile_number: z.string(),
  category_id: Text,
  category: Ref.nullable(),
  engagement_type: z.enum(ENGAGEMENT_TYPES),
  employment_basis: z.enum(EMPLOYMENT_BASES).nullable(),
  job_nature: z.enum(JOB_NATURES).nullable(),
  working_location: z.enum(WORKING_LOCATIONS).nullable(),
  job_grade_id: Text,
  job_grade: Ref.nullable(),
  work_email: Text,
  joining_date: z.string(),
  confirmation_date: Text,
  probation_end_date: Text,
  on_probation: z.boolean(),
  separation_date: Text,
  separation_type: z.enum(SEPARATION_TYPES).nullable(),
  separation_reason: Text,
  supervisor_profile_id: Text,
  supervisor: z.looseObject({ id: z.string(), profile_number: z.string(), full_name: z.string() }).nullable(),
  is_service_continuous: z.boolean(),
  service_years: z.number(),
  nominee_name: Text,
  nominee_relation: z.enum(RELATIONS).nullable(),
  nominee_date_of_birth: Text,
  nominee_national_id: Text,
  nominee_phone: Text,
  nominee_address: Text,
  remarks: Text,
  current_assignment: z
    .looseObject({
      id: z.string(),
      effective_from: z.string(),
      department: Ref.nullable(),
      designation: Ref.nullable(),
      division: Ref.nullable(),
      section: Ref.nullable(),
      activity_type: Ref.nullable(),
      wage_basis: z.string(),
    })
    .nullable(),
  status: z.enum(PROFILE_STATUSES),
  user: z.looseObject({ id: z.string(), username: z.string() }).nullable(),
  created_by: z.looseObject({ id: z.string(), username: z.string() }),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: Text,
});
export type Profile = z.infer<typeof ProfileSchema>;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const Bucket = z.looseObject({ key: z.string(), label: z.string(), count: z.number().int() });
export type Bucket = z.infer<typeof Bucket>;

/** The cards and charts of Worker / Employee Management. Percentages and tenure are decimal strings. */
export const WorkforceSummarySchema = z.looseObject({
  total: z.number().int(),
  active: z.number().int(),
  on_leave: z.number().int(),
  suspended: z.number().int(),
  separated: z.number().int(),
  active_pct: z.string(),
  on_leave_pct: z.string(),
  new_this_month: z.number().int(),
  exits_this_month: z.number().int(),
  average_tenure_years: Text,
  by_category: z.array(Bucket),
  by_department: z.array(Bucket),
  by_engagement_type: z.array(Bucket),
  by_gender: z.array(Bucket),
  by_age_group: z.array(Bucket),
  by_length_of_service: z.array(Bucket),
  birthdays_this_month: z.array(
    z.looseObject({ profile_id: z.string(), full_name: z.string(), date: z.string() }),
  ),
  anniversaries_this_month: z.array(
    z.looseObject({
      profile_id: z.string(),
      full_name: z.string(),
      date: z.string(),
      years: z.number().int(),
    }),
  ),
});
export type WorkforceSummary = z.infer<typeof WorkforceSummarySchema>;

export const ServiceSummarySchema = z.looseObject({
  person_id: z.string(),
  profiles: z.number().int(),
  continuous_service_days: z.number().int(),
  total_service_days: z.number().int(),
  first_joining_date: Text,
  current_profile_id: Text,
});
export type ServiceSummary = z.infer<typeof ServiceSummarySchema>;
