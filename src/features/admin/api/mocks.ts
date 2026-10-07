import { http, type RequestHandler } from 'msw';

import {
  apiError,
  created,
  noContent,
  ok,
  page,
  queryList,
  requireAuth,
  requireIfMatch,
} from '@/lib/mocking/contract';

import { type Permission, type Role, type ScopeGrant, type User } from './schemas';

/**
 * In-memory identity API (P1.01) for VITE_MOCK_API=admin and for tests. It follows the backend's rules that the
 * screens depend on: If-Match on every change, a system role keeps its code and permissions and cannot be
 * deleted, a role held by users cannot be deleted, and a user's permissions are the union of their active roles.
 */

const NOW = '2026-01-01T04:00:00.000Z';

const MODULES: readonly {
  module: string;
  group: string;
  actions: Permission['action'][];
  sensitive?: boolean;
}[] = [
  { module: 'user', group: 'Administration', actions: ['view', 'create', 'edit', 'delete'], sensitive: true },
  { module: 'role', group: 'Administration', actions: ['view', 'create', 'edit', 'delete'], sensitive: true },
  { module: 'audit', group: 'Administration', actions: ['view', 'export'] },
  { module: 'worker', group: 'Workforce', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { module: 'attendance', group: 'Workforce', actions: ['view', 'create', 'edit', 'submit', 'approve'] },
  {
    module: 'payroll',
    group: 'Finance',
    actions: ['view', 'create', 'approve', 'post', 'reopen'],
    sensitive: true,
  },
];

function catalogue(): Permission[] {
  return MODULES.flatMap(({ module, group, actions, sensitive }) =>
    actions.map((action) => ({
      id: `perm_${module}_${action}`,
      key: `${module}.${action}`,
      module,
      action,
      group,
      module_class: 'operational' as const,
      description: null,
      sensitive: sensitive === true && action !== 'view',
    })),
  );
}

interface Store {
  roles: Role[];
  users: User[];
  /** Data-scope grants (P1.03), all users together. */
  scopes: ScopeGrant[];
  /** For the ids of created records. */
  sequence: number;
}

function seed(): Store {
  const all = catalogue().map((permission) => permission.key);
  const role = (
    id: string,
    code: string,
    name: string,
    permissions: string[],
    isSystem: boolean,
    sort: number,
  ) =>
    ({
      id,
      code,
      name,
      description: null,
      sort_order: sort,
      is_system: isSystem,
      status: 'active',
      permissions,
      user_count: 0,
      version: 1,
      created_at: NOW,
      updated_at: null,
    }) satisfies Role;
  const roles = [
    role('rol_admin', 'ADMIN', 'Administrator', all, true, 10),
    role(
      'rol_supervisor',
      'FIELD_SUPERVISOR',
      'Field supervisor',
      ['worker.view', 'attendance.view', 'attendance.create'],
      false,
      50,
    ),
    role(
      'rol_clerk',
      'PAYROLL_CLERK',
      'Payroll clerk',
      ['worker.view', 'payroll.view', 'payroll.create'],
      false,
      60,
    ),
  ];
  const user = (id: string, username: string, roleIds: string[]): User => ({
    id,
    username,
    email: `${username}@example.com`,
    phone: null,
    status: 'active',
    must_change_password: false,
    two_factor_enabled: false,
    last_login_at: null,
    locked_until: null,
    person_id: null,
    employment_profile_id: null,
    roles: roleIds.map((roleId) => grant(roles, roleId, null)),
    version: 1,
    created_at: NOW,
    updated_at: null,
  });
  const store: Store = {
    roles,
    users: [user('usr_admin', 'admin', ['rol_admin']), user('usr_rahim', 'rahim', ['rol_supervisor'])],
    scopes: [
      scopeGrant('scp_1', 'usr_admin', 'all_estates', null, null),
      scopeGrant('scp_2', 'usr_rahim', 'estate', '3', null),
      scopeGrant('scp_3', 'usr_rahim', 'division', '12', '2025-12-31T17:59:59.000Z'),
    ],
    sequence: 0,
  };
  recount(store);
  return store;
}

function scopeGrant(
  id: string,
  userId: string,
  type: ScopeGrant['scope_type'],
  scopeId: string | null,
  expiresAt: string | null,
): ScopeGrant {
  return {
    id,
    user_id: userId,
    scope_type: type,
    scope_id: scopeId,
    granted_at: NOW,
    granted_by: 'usr_admin',
    expires_at: expiresAt,
    active: expiresAt === null || new Date(expiresAt) > new Date(),
    version: 1,
    created_at: NOW,
    updated_at: null,
  };
}

function grant(roles: readonly Role[], roleId: string, expiresAt: string | null): User['roles'][number] {
  const role = roles.find((r) => r.id === roleId);
  return {
    id: roleId,
    code: role?.code ?? '',
    name: role?.name ?? '',
    status: role?.status ?? 'inactive',
    granted_at: NOW,
    expires_at: expiresAt,
  };
}

function recount(store: Store): void {
  for (const role of store.roles) {
    role.user_count = store.users.filter((user) => user.roles.some((r) => r.id === role.id)).length;
  }
}

let store = seed();

/** Back to the seeded users and roles (between tests). */
export function resetAdminMocks(): void {
  store = seed();
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const touch = <T extends { version: number; updated_at: string | null }>(record: T): T => {
  record.version += 1;
  record.updated_at = new Date().toISOString();
  return record;
};
const userRow = (user: User) => ({ ...user, role_id: user.roles.map((r) => r.id).join(',') });

export function adminMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.get(
      `${base}/permissions`,
      ({ request }) => requireAuth(request) ?? page(request, queryList(catalogue(), request)),
    ),

    // ---- Users ----
    http.get(`${base}/users`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const roleFilter = new URL(request.url).searchParams.get('filter[role_id]');
      const url = new URL(request.url);
      url.searchParams.delete('filter[role_id]');
      const rows = queryList(store.users.map(userRow), new Request(url)).filter(
        (user) => !roleFilter || user.roles.some((role) => role.id === roleFilter),
      );
      return page(request, rows);
    }),
    http.post(`${base}/users`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as { username: string; email: string | null; phone: string | null };
      if (store.users.some((u) => u.username === body.username)) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'username', code: 'UNIQUE', message: 'This username is already taken.' },
        ]);
      }
      store.sequence += 1;
      const user: User = {
        id: `usr_new_${String(store.sequence)}`,
        username: body.username,
        email: body.email,
        phone: body.phone,
        status: 'active',
        must_change_password: true,
        two_factor_enabled: false,
        last_login_at: null,
        locked_until: null,
        person_id: null,
        employment_profile_id: null,
        roles: [],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      store.users.push(user);
      return created(user, `${base}/users/${user.id}`, user.version);
    }),
    http.get(`${base}/users/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const user = store.users.find((u) => u.id === params.id);
      return user ? ok(user, { version: user.version }) : notFound();
    }),
    http.put(`${base}/users/:id`, async ({ request, params }) => {
      const user = store.users.find((u) => u.id === params.id);
      if (!user) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, user.version);
      if (refused) return refused;
      Object.assign(user, (await request.json()) as Partial<User>);
      return ok(touch(user), { version: user.version });
    }),
    // ---- Data scope (P1.03); before /users/:id/:action, which would otherwise take POST …/scopes ----
    http.get(`${base}/users/:id/scopes`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      if (!store.users.some((u) => u.id === params.id)) return notFound();
      return page(
        request,
        store.scopes.filter((g) => g.user_id === params.id),
      );
    }),
    http.post(`${base}/users/:id/scopes`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const userId = String(params.id);
      if (!store.users.some((u) => u.id === userId)) return notFound();
      const body = (await request.json()) as {
        scope_type: ScopeGrant['scope_type'];
        scope_id?: string | null;
        expires_at?: string | null;
      };
      const scopeId = body.scope_type === 'all_estates' ? null : (body.scope_id ?? null);
      if (body.expires_at && new Date(body.expires_at) <= new Date()) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'expires_at', code: 'VALIDATION_FAILED', message: 'Must be in the future.' },
        ]);
      }
      const held = store.scopes.some(
        (g) => g.user_id === userId && g.scope_type === body.scope_type && g.scope_id === scopeId,
      );
      if (held) {
        return apiError(422, 'DUPLICATE_KEY', 'The user already holds this scope.', [
          {
            field: 'scope_id',
            code: 'DUPLICATE_KEY',
            message: 'Change the existing grant’s expiry instead.',
          },
        ]);
      }
      store.sequence += 1;
      const added = scopeGrant(
        `scp_new_${String(store.sequence)}`,
        userId,
        body.scope_type,
        scopeId,
        body.expires_at ?? null,
      );
      store.scopes.push(added);
      return created(added, `${base}/users/${userId}/scopes/${added.id}`, added.version);
    }),
    http.patch(`${base}/users/:id/scopes/:grantId`, async ({ request, params }) => {
      const found = store.scopes.find((g) => g.user_id === params.id && g.id === params.grantId);
      if (!found) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, found.version);
      if (refused) return refused;
      const body = (await request.json()) as { expires_at: string | null };
      found.expires_at = body.expires_at;
      found.active = body.expires_at === null || new Date(body.expires_at) > new Date();
      return ok(touch(found), { version: found.version });
    }),
    http.delete(`${base}/users/:id/scopes/:grantId`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const before = store.scopes.length;
      store.scopes = store.scopes.filter((g) => !(g.user_id === params.id && g.id === params.grantId));
      return store.scopes.length === before ? notFound() : noContent();
    }),
    http.post(`${base}/users/:id/:action`, async ({ request, params }) => {
      const user = store.users.find((u) => u.id === params.id);
      if (!user) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, user.version);
      if (refused) return refused;
      if (params.action === 'roles') {
        const body = (await request.json()) as { roles: { role_id: string; expires_at: string | null }[] };
        user.roles = body.roles.map((r) => grant(store.roles, r.role_id, r.expires_at));
        recount(store);
      } else if (params.action === 'deactivate' || params.action === 'reactivate') {
        user.status = params.action === 'deactivate' ? 'disabled' : 'active';
      } else {
        return notFound();
      }
      return ok(touch(user), { version: user.version });
    }),
    http.delete(`${base}/users/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      store.users = store.users.filter((u) => u.id !== params.id);
      recount(store);
      return noContent();
    }),
    http.get(`${base}/users/:id/permissions`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const user = store.users.find((u) => u.id === params.id);
      if (!user) return notFound();
      const held = store.roles.filter(
        (role) => role.status === 'active' && user.roles.some((r) => r.id === role.id),
      );
      const permissions =
        user.status === 'active' ? [...new Set(held.flatMap((role) => role.permissions))].sort() : [];
      return ok({ user_id: user.id, status: user.status, permissions });
    }),

    // ---- Roles ----
    http.get(
      `${base}/roles`,
      ({ request }) => requireAuth(request) ?? page(request, queryList(store.roles, request)),
    ),
    http.post(`${base}/roles`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as Pick<
        Role,
        'code' | 'name' | 'description' | 'sort_order' | 'permissions'
      >;
      if (store.roles.some((r) => r.code === body.code)) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
          { field: 'code', code: 'UNIQUE', message: 'A role with this code already exists.' },
        ]);
      }
      store.sequence += 1;
      const role: Role = {
        ...body,
        id: `rol_new_${String(store.sequence)}`,
        is_system: false,
        status: 'active',
        user_count: 0,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      store.roles.push(role);
      return created(role, `${base}/roles/${role.id}`, role.version);
    }),
    http.get(`${base}/roles/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const role = store.roles.find((r) => r.id === params.id);
      return role ? ok(role, { version: role.version }) : notFound();
    }),
    http.put(`${base}/roles/:id`, async ({ request, params }) => {
      const role = store.roles.find((r) => r.id === params.id);
      if (!role) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, role.version);
      if (refused) return refused;
      if (role.is_system)
        return apiError(409, 'SYSTEM_RECORD', 'A system role’s code and permissions are fixed.');
      Object.assign(role, (await request.json()) as Partial<Role>);
      return ok(touch(role), { version: role.version });
    }),
    http.patch(`${base}/roles/:id`, async ({ request, params }) => {
      const role = store.roles.find((r) => r.id === params.id);
      if (!role) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, role.version);
      if (refused) return refused;
      const body = (await request.json()) as Pick<Role, 'name' | 'description' | 'sort_order'>;
      Object.assign(role, { name: body.name, description: body.description, sort_order: body.sort_order });
      return ok(touch(role), { version: role.version });
    }),
    http.post(`${base}/roles/:id/:action`, ({ request, params }) => {
      const role = store.roles.find((r) => r.id === params.id);
      if (!role) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, role.version);
      if (refused) return refused;
      if (role.is_system) return apiError(409, 'SYSTEM_RECORD', 'A system role cannot be deactivated.');
      role.status = params.action === 'deactivate' ? 'inactive' : 'active';
      return ok(touch(role), { version: role.version });
    }),
    http.delete(`${base}/roles/:id`, ({ request, params }) => {
      const role = store.roles.find((r) => r.id === params.id);
      if (!role) return notFound();
      const refused = requireAuth(request);
      if (refused) return refused;
      if (role.is_system) return apiError(409, 'SYSTEM_RECORD', 'A system role cannot be deleted.');
      if (role.user_count > 0) {
        return apiError(409, 'IN_USE', 'This role is held by users. Remove it from them, or deactivate it.');
      }
      store.roles = store.roles.filter((r) => r.id !== role.id);
      return noContent();
    }),
  ];
}

/** For the app's mock loader (VITE_MOCK_API=admin). */
export const handlers: RequestHandler[] = adminMocks();
