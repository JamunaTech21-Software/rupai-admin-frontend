import { z } from 'zod';

/**
 * The shapes of the identity API (P1.01, backend identity.schema.ts). Checked against every response outside
 * production, so a contract change fails loudly in development and staging.
 */
export const UserRoleSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive']),
  granted_at: z.string(),
  expires_at: z.string().nullable(),
});

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.enum(['active', 'disabled']),
  must_change_password: z.boolean(),
  two_factor_enabled: z.boolean(),
  last_login_at: z.string().nullable(),
  locked_until: z.string().nullable(),
  person_id: z.string().nullable(),
  employment_profile_id: z.string().nullable(),
  roles: z.array(UserRoleSchema),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const UserPermissionsSchema = z.object({
  user_id: z.string(),
  status: z.enum(['active', 'disabled']),
  permissions: z.array(z.string()),
});

export const RoleSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sort_order: z.number(),
  is_system: z.boolean(),
  status: z.enum(['active', 'inactive']),
  permissions: z.array(z.string()),
  user_count: z.number(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type Role = z.infer<typeof RoleSchema>;

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'submit',
  'approve',
  'reject',
  'post',
  'export',
  'print',
  'reopen',
  'write_off',
  'register',
  'revoke',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PermissionSchema = z.object({
  id: z.string(),
  key: z.string(),
  module: z.string(),
  action: z.enum(PERMISSION_ACTIONS),
  group: z.string(),
  module_class: z.enum(['reference', 'master', 'operational', 'financial', 'derived', 'policy']),
  description: z.string().nullable(),
  sensitive: z.boolean(),
});
export type Permission = z.infer<typeof PermissionSchema>;

/** Role codes as the backend accepts them: upper case, digits and underscores, 2–20 characters. */
export const ROLE_CODE = /^[A-Z][A-Z0-9_]{1,19}$/;

/** Data-scope grants (P1.03). `self` is implicit for everyone, so it is listed by the API but never granted. */
export const SCOPE_TYPES = [
  'all_estates',
  'estate',
  'division',
  'section',
  'department',
  'factory',
  'warehouse',
  'self',
] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];
export const GRANTABLE_SCOPE_TYPES = [
  'all_estates',
  'estate',
  'division',
  'section',
  'department',
  'factory',
  'warehouse',
] as const satisfies readonly ScopeType[];
export type GrantableScopeType = (typeof GRANTABLE_SCOPE_TYPES)[number];

export const ScopeGrantSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  scope_type: z.enum(SCOPE_TYPES),
  scope_id: z.string().nullable(),
  granted_at: z.string(),
  granted_by: z.string(),
  expires_at: z.string().nullable(),
  /** false once expires_at has passed: the grant is kept but confers nothing. */
  active: z.boolean(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type ScopeGrant = z.infer<typeof ScopeGrantSchema>;

// ---- Separation of duties & sensitive permissions (P1.04, backend identity.schema.ts) ----

export const AUTHORISATION_KINDS = ['sod_override', 'sensitive_grant'] as const;
export type AuthorisationKind = (typeof AUTHORISATION_KINDS)[number];

/** One conflict or sensitive permission a set of roles brings, and whether an authorisation covers it. */
export const RequirementSchema = z.object({
  key: z.string(),
  kind: z.enum(AUTHORISATION_KINDS),
  rule: z.string(),
  title: z.string(),
  why: z.string(),
  permissions: z.array(z.string()),
  authorised: z.boolean(),
});
export type Requirement = z.infer<typeof RequirementSchema>;

/** POST /users/{id}/roles/check: what a set of roles would require, without changing anything. */
export const AccessCheckSchema = z.object({
  user_id: z.string(),
  permissions: z.array(z.string()),
  requirements: z.array(RequirementSchema),
  missing: z.number(),
});

/** A recorded, named authorisation (override or sensitive grant) on one user. */
export const AuthorisationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  kind: z.enum(AUTHORISATION_KINDS),
  rule: z.string(),
  key: z.string(),
  permissions: z.array(z.string()),
  reason: z.string(),
  authorised_by: z.string(),
  authorised_at: z.string(),
  removed_at: z.string().nullable(),
  removed_by: z.string().nullable(),
  active: z.boolean(),
});
export type Authorisation = z.infer<typeof AuthorisationSchema>;

export const SodRuleSchema = z.object({
  code: z.string(),
  title: z.string(),
  why: z.string(),
  combinations: z.array(z.array(z.string())),
});
export type SodRule = z.infer<typeof SodRuleSchema>;

const UserRefSchema = z.object({ id: z.string(), username: z.string() });

/** GET /access/concentration-report: where authority is concentrated, and what nobody signed off. */
export const ConcentrationReportSchema = z.object({
  generated_at: z.string(),
  active_overrides: z.array(AuthorisationSchema.extend({ user: UserRefSchema, still_held: z.boolean() })),
  sensitive_holders: z.array(
    z.object({
      permission: z.string(),
      why: z.string(),
      holders: z.array(UserRefSchema.extend({ authorised: z.boolean() })),
    }),
  ),
  users_with_many_roles: z.array(UserRefSchema.extend({ roles: z.array(z.string()) })),
  approve_and_post: z.array(UserRefSchema.extend({ modules: z.array(z.string()) })),
  unauthorised: z.array(UserRefSchema.extend({ requirements: z.array(RequirementSchema) })),
});
export type ConcentrationReport = z.infer<typeof ConcentrationReportSchema>;
