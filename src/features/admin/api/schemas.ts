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
