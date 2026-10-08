import { http, type RequestHandler } from 'msw';

import {
  apiError,
  created,
  cursorPage,
  mockSession,
  noContent,
  ok,
  page,
  queryList,
  requireAuth,
  requireIfMatch,
} from '@/lib/mocking/contract';

import {
  type Authorisation,
  type Permission,
  type Requirement,
  type Role,
  type ScopeGrant,
  type SodRule,
  type User,
} from './schemas';
import { type AccessLogEntry, type AuditChange, type StatusChange } from './audit';

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
  /** Separation-of-duties overrides and sensitive grants (P1.04), all users together. */
  authorisations: Authorisation[];
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
    // With the clerk role it makes create + approve on payroll: a separation-of-duties conflict (SOD-1).
    role(
      'rol_approver',
      'PAYROLL_APPROVER',
      'Payroll approver',
      ['payroll.view', 'payroll.approve'],
      false,
      70,
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
    authorisations: [],
    sequence: 0,
  };
  // The administrator's concentration was signed off at installation, except for payroll.post: one item the
  // access review shows as not authorised.
  const admin = store.users.find((u) => u.id === 'usr_admin');
  for (const requirement of admin ? requirementsFor(effectivePermissions(store, admin)) : []) {
    if (requirement.key === 'SENSITIVE:payroll.post') continue;
    store.authorisations.push(
      authorisationRow(store, 'usr_admin', requirement, 'Accepted at installation.', 'usr_admin'),
    );
  }
  recount(store);
  return store;
}

// ---- Separation of duties (P1.04): a small copy of the backend's rules, enough for the screens ----------

const SOD_RULES: readonly SodRule[] = [
  {
    code: 'SOD-1',
    title: 'Create and approve on the same document type',
    why: 'One person could raise and authorise their own document.',
    combinations: [
      ['attendance.approve', 'attendance.create'],
      ['payroll.approve', 'payroll.create'],
    ],
  },
  {
    code: 'SOD-2',
    title: 'Approve and post on the same document type',
    why: 'Business authorisation and accounting entry are deliberately separate acts.',
    combinations: [['payroll.approve', 'payroll.post']],
  },
];
const SENSITIVE: readonly string[] = ['payroll.post', 'role.edit', 'user.edit'];

function requirementsFor(permissions: ReadonlySet<string>): Omit<Requirement, 'authorised'>[] {
  const out: Omit<Requirement, 'authorised'>[] = [];
  for (const rule of SOD_RULES) {
    for (const combination of rule.combinations) {
      if (combination.every((p) => permissions.has(p))) {
        const sorted = [...combination].sort();
        out.push({
          key: `${rule.code}:${sorted.join('+')}`,
          kind: 'sod_override',
          rule: rule.code,
          title: rule.title,
          why: rule.why,
          permissions: sorted,
        });
      }
    }
  }
  for (const p of SENSITIVE) {
    if (permissions.has(p)) {
      out.push({
        key: `SENSITIVE:${p}`,
        kind: 'sensitive_grant',
        rule: 'SENSITIVE',
        title: `Sensitive permission ${p}`,
        why: 'Listed in P6 Table 10.1.',
        permissions: [p],
      });
    }
  }
  return out;
}

function permissionsOf(store: Store, roleIds: readonly string[]): Set<string> {
  const held = store.roles.filter((role) => role.status === 'active' && roleIds.includes(role.id));
  return new Set(held.flatMap((role) => role.permissions));
}

function effectivePermissions(store: Store, user: User): Set<string> {
  return user.status === 'active'
    ? permissionsOf(
        store,
        user.roles.map((r) => r.id),
      )
    : new Set();
}

const isAuthorised = (store: Store, userId: string, key: string) =>
  store.authorisations.some((a) => a.active && a.user_id === userId && a.key === key);

function authorisationRow(
  store: Store,
  userId: string,
  requirement: Omit<Requirement, 'authorised'>,
  reason: string,
  actor: string,
): Authorisation {
  store.sequence += 1;
  return {
    id: `auth_${String(store.sequence)}`,
    user_id: userId,
    kind: requirement.kind,
    rule: requirement.rule,
    key: requirement.key,
    permissions: requirement.permissions,
    reason,
    authorised_by: actor,
    authorised_at: new Date().toISOString(),
    removed_at: null,
    removed_by: null,
    active: true,
  };
}

interface Given {
  key: string;
  reason: string;
  user_id?: string;
}

/**
 * The backend's rule for any change that alters who holds what: every conflict or sensitive permission the
 * affected users would hold must already be authorised or be authorised in this request (reason ≥ 10). Returns
 * the refusal to send, or null after recording the new authorisations.
 */
function authorise(
  store: Store,
  affected: readonly { user: User; permissions: Set<string> }[],
  given: readonly Given[],
  perUser: boolean,
): Response | null {
  const reasonErrors = given.flatMap((g, i) =>
    g.reason.trim().length < 10
      ? [
          {
            field: `authorisations.${String(i)}.reason`,
            code: 'TOO_SHORT',
            message: 'Give a real reason (at least 10 characters).',
          },
        ]
      : [],
  );
  if (reasonErrors.length > 0)
    return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', reasonErrors);
  const missing: { user: User; requirement: Omit<Requirement, 'authorised'> }[] = [];
  const toRecord: { user: User; requirement: Omit<Requirement, 'authorised'>; reason: string }[] = [];
  for (const { user, permissions } of affected) {
    for (const requirement of requirementsFor(permissions)) {
      if (isAuthorised(store, user.id, requirement.key)) continue;
      const match = given.find((g) => g.key === requirement.key && (!perUser || g.user_id === user.id));
      if (match) toRecord.push({ user, requirement, reason: match.reason.trim() });
      else missing.push({ user, requirement });
    }
  }
  if (missing.length > 0) {
    return apiError(
      422,
      'AUTHORISATION_REQUIRED',
      'This change needs a named authorisation for each conflict and sensitive permission listed.',
      missing.map(({ user, requirement }) => ({
        code: requirement.kind === 'sod_override' ? 'SOD_CONFLICT' : 'SENSITIVE_PERMISSION',
        message: `${user.username}: ${requirement.title}. ${requirement.why}`,
        context: { ...requirement, user_id: user.id, username: user.username },
      })),
    );
  }
  const actor = mockSession.signedIn?.userId ?? 'usr_admin';
  for (const { user, requirement, reason } of toRecord) {
    store.authorisations.push(authorisationRow(store, user.id, requirement, reason, actor));
  }
  return null;
}

/** GET /access/concentration-report, computed from the store. */
function concentrationReport(store: Store) {
  const active = store.users.filter((user) => user.status === 'active');
  const held = new Map(active.map((user) => [user.id, effectivePermissions(store, user)]));
  const ref = (user: User) => ({ id: user.id, username: user.username });
  return {
    generated_at: new Date().toISOString(),
    active_overrides: store.authorisations
      .filter((a) => a.active)
      .map((a) => {
        const user = store.users.find((u) => u.id === a.user_id);
        const permissions = held.get(a.user_id) ?? new Set<string>();
        return {
          ...a,
          user: { id: a.user_id, username: user?.username ?? a.user_id },
          still_held: a.permissions.every((p) => permissions.has(p)),
        };
      }),
    sensitive_holders: SENSITIVE.map((permission) => ({
      permission,
      why: 'Listed in P6 Table 10.1.',
      holders: active
        .filter((user) => held.get(user.id)?.has(permission))
        .map((user) => ({
          ...ref(user),
          authorised: isAuthorised(store, user.id, `SENSITIVE:${permission}`),
        })),
    })).filter((row) => row.holders.length > 0),
    users_with_many_roles: active
      .filter((user) => user.roles.length >= 4)
      .map((user) => ({ ...ref(user), roles: user.roles.map((r) => r.name) })),
    approve_and_post: active
      .map((user) => {
        const permissions = held.get(user.id) ?? new Set<string>();
        const modules = [...new Set([...permissions].map((p) => p.split('.')[0] ?? ''))].filter(
          (m) => permissions.has(`${m}.approve`) && permissions.has(`${m}.post`),
        );
        return { ...ref(user), modules };
      })
      .filter((row) => row.modules.length > 0),
    unauthorised: active
      .map((user) => ({
        ...ref(user),
        requirements: requirementsFor(held.get(user.id) ?? new Set())
          .filter((r) => !isAuthorised(store, user.id, r.key))
          .map((r) => ({ ...r, authorised: false })),
      }))
      .filter((row) => row.requirements.length > 0),
  };
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

// ---- Audit (P1.05): a few days of seeded history, newest first, relative to now ----------------------------

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const ADMIN_REF = { id: 'usr_admin', username: 'admin' };

function seedAudit() {
  const change = (
    id: string,
    hours: number,
    record_type: string,
    record_id: string,
    action: AuditChange['action'],
    field: string | null,
    old_value: string | null,
    new_value: string | null,
    reason: string | null = null,
  ): AuditChange => ({
    id,
    record_type,
    record_id,
    action,
    field,
    old_value,
    new_value,
    changed_by: ADMIN_REF,
    acting_for_user_id: null,
    changed_at: hoursAgo(hours),
    ip_address: '::ffff:127.0.0.1',
    user_agent: null,
    reason,
  });
  const changes: AuditChange[] = [
    change('ch_1', 2, 'user', 'usr_rahim', 'update', 'email', 'rahim@old.example.com', 'rahim@example.com'),
    change('ch_2', 5, 'user', 'usr_rahim', 'update', 'roles', '[]', '["FIELD_SUPERVISOR"]'),
    change('ch_3', 30, 'role', 'rol_supervisor', 'update', 'name', 'Supervisor', 'Field supervisor'),
    change(
      'ch_4',
      50,
      'user',
      'usr_rahim',
      'create',
      null,
      null,
      '{"username":"rahim","email":"rahim@old.example.com","status":"active"}',
    ),
    // Older than the default 7-day window: only a longer period (or the record's history) shows it.
    change('ch_5', 24 * 20, 'role', 'rol_clerk', 'create', null, null, '{"code":"PAYROLL_CLERK"}'),
  ];
  const statuses: StatusChange[] = [
    {
      id: 'st_1',
      record_type: 'user',
      record_id: 'usr_rahim',
      from_state: null,
      to_state: 'active',
      changed_by: ADMIN_REF,
      changed_at: hoursAgo(50),
      workflow_step_id: null,
      comment: null,
    },
  ];
  const access = (
    id: string,
    hours: number,
    event_type: AccessLogEntry['event_type'],
    user: AccessLogEntry['user'],
    extra: Partial<AccessLogEntry> = {},
  ): AccessLogEntry => ({
    id,
    user,
    event_type,
    module: null,
    record_reference: null,
    ip_address: '::ffff:127.0.0.1',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/129.0',
    occurred_at: hoursAgo(hours),
    detail: null,
    ...extra,
  });
  const accessLog: AccessLogEntry[] = [
    access('ac_1', 1, 'login', ADMIN_REF),
    access(
      'ac_2',
      3,
      'permission_denied',
      { id: 'usr_rahim', username: 'rahim' },
      {
        module: 'payroll',
        detail: { permission: 'payroll.approve' },
      },
    ),
    access('ac_3', 4, 'failed_login', null, { detail: { username: 'rahim' } }),
    access('ac_4', 6, 'export', ADMIN_REF, { module: 'user', record_reference: 'users.csv' }),
  ];
  return { changes, statuses, accessLog };
}

let audit = seedAudit();

/** Back to the seeded users, roles and audit trail (between tests). */
export function resetAdminMocks(): void {
  store = seed();
  audit = seedAudit();
}

/**
 * The audit lists' rules: a `field` range is required (at most 366 days) unless a record_id filter is given;
 * newest first; cursor pages. Range bounds are compared as instants, the other filters by queryList.
 */
function auditList<T extends Record<string, unknown>>(
  request: Request,
  rows: readonly T[],
  field: string,
  /** Filters on a nested user: filter[name] matches this id. */
  userFilters: Readonly<Record<string, (row: T) => string | null>> = {},
): Response {
  const url = new URL(request.url);
  const from = url.searchParams.get(`filter[${field}][from]`);
  const to = url.searchParams.get(`filter[${field}][to]`);
  const named = url.searchParams.has('filter[record_id]');
  if (!named && (!from || !to)) {
    return apiError(422, 'RANGE_REQUIRED', `This list needs a ${field} range.`, [
      { field: `filter[${field}]`, code: 'RANGE_REQUIRED', message: 'Give a from and a to.' },
    ]);
  }
  if (!named && from && to && (Date.parse(to) - Date.parse(from)) / 86_400_000 > 366) {
    return apiError(422, 'VALIDATION_FAILED', 'The request is not valid.', [
      {
        field: `filter[${field}]`,
        code: 'VALIDATION_FAILED',
        message: 'The range may span at most 366 days.',
      },
    ]);
  }
  url.searchParams.delete(`filter[${field}][from]`);
  url.searchParams.delete(`filter[${field}][to]`);
  const wanted = Object.entries(userFilters).flatMap(([name, idOf]) => {
    const id = url.searchParams.get(`filter[${name}]`);
    url.searchParams.delete(`filter[${name}]`);
    return id ? [{ id, idOf }] : [];
  });
  const inRange = rows.filter((row) => {
    if (!wanted.every(({ id, idOf }) => idOf(row) === id)) return false;
    const at = Date.parse(String(row[field]));
    return (!from || at >= Date.parse(from)) && (!to || at <= Date.parse(to));
  });
  const filtered = queryList(inRange, new Request(url)).sort((a, b) =>
    String(b[field]).localeCompare(String(a[field])),
  );
  return cursorPage(request, filtered);
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The record does not exist.');
const touch = <T extends { version: number; updated_at: string | null }>(record: T): T => {
  record.version += 1;
  record.updated_at = new Date().toISOString();
  return record;
};
const userRow = (user: User) => ({ ...user, role_id: user.roles.map((r) => r.id).join(',') });

/** A role change re-checks every holder as if the role had these permissions (and, on reactivation, were active). */
function authoriseHolders(
  role: Role,
  permissions: readonly string[],
  given: readonly Given[],
  reactivating = false,
) {
  const holders = store.users.filter(
    (user) => user.status === 'active' && user.roles.some((r) => r.id === role.id),
  );
  const affected = holders.map((user) => {
    const others = permissionsOf(
      store,
      user.roles.map((r) => r.id).filter((id) => id !== role.id),
    );
    if (role.status === 'active' || reactivating) for (const p of permissions) others.add(p);
    return { user, permissions: others };
  });
  return authorise(store, affected, given, true);
}

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
    // ---- Separation of duties (P1.04); before the generic /users/:id/:action ----
    http.post(`${base}/users/:id/roles/check`, async ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const user = store.users.find((u) => u.id === params.id);
      if (!user) return notFound();
      const body = (await request.json()) as { roles: { role_id: string }[] };
      const permissions = permissionsOf(
        store,
        body.roles.map((r) => r.role_id),
      );
      const requirements = requirementsFor(permissions).map((r) => ({
        ...r,
        authorised: isAuthorised(store, user.id, r.key),
      }));
      return ok({
        user_id: user.id,
        permissions: [...permissions].sort(),
        requirements,
        missing: requirements.filter((r) => !r.authorised).length,
      });
    }),
    http.get(`${base}/users/:id/authorisations`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      return page(
        request,
        store.authorisations.filter((a) => a.user_id === params.id),
      );
    }),
    http.delete(`${base}/users/:id/authorisations/:authorisationId`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = store.authorisations.find(
        (a) => a.user_id === params.id && a.id === params.authorisationId && a.active,
      );
      if (!row) return notFound();
      Object.assign(row, {
        active: false,
        removed_at: new Date().toISOString(),
        removed_by: mockSession.signedIn?.userId ?? 'usr_admin',
      });
      return noContent();
    }),
    http.get(
      `${base}/access/concentration-report`,
      ({ request }) => requireAuth(request) ?? ok(concentrationReport(store)),
    ),
    http.get(`${base}/access/sod-rules`, ({ request }) => requireAuth(request) ?? page(request, SOD_RULES)),

    // ---- Audit (P1.05) ----
    http.get(
      `${base}/audit/changes`,
      ({ request }) =>
        requireAuth(request) ??
        auditList(request, audit.changes, 'changed_at', { changed_by: (row) => row.changed_by?.id ?? null }),
    ),
    http.get(
      `${base}/audit/status-history`,
      ({ request }) => requireAuth(request) ?? auditList(request, audit.statuses, 'changed_at'),
    ),
    http.get(
      `${base}/audit/access-log`,
      ({ request }) =>
        requireAuth(request) ??
        auditList(request, audit.accessLog, 'occurred_at', { user_id: (row) => row.user?.id ?? null }),
    ),

    http.post(`${base}/users/:id/:action`, async ({ request, params }) => {
      const user = store.users.find((u) => u.id === params.id);
      if (!user) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, user.version);
      if (refused) return refused;
      if (params.action === 'roles') {
        const body = (await request.json()) as {
          roles: { role_id: string; expires_at: string | null }[];
          authorisations?: Given[];
        };
        const permissions = permissionsOf(
          store,
          body.roles.map((r) => r.role_id),
        );
        const refusal = authorise(store, [{ user, permissions }], body.authorisations ?? [], false);
        if (refusal) return refusal;
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
      const { authorisations, ...changes } = (await request.json()) as Partial<Role> & {
        authorisations?: Given[];
      };
      const refusal = authoriseHolders(role, changes.permissions ?? role.permissions, authorisations ?? []);
      if (refusal) return refusal;
      Object.assign(role, changes);
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
    http.post(`${base}/roles/:id/:action`, async ({ request, params }) => {
      const role = store.roles.find((r) => r.id === params.id);
      if (!role) return notFound();
      const refused = requireAuth(request) ?? requireIfMatch(request, role.version);
      if (refused) return refused;
      if (role.is_system) return apiError(409, 'SYSTEM_RECORD', 'A system role cannot be deactivated.');
      if (params.action === 'reactivate') {
        const body = (await request.json().catch(() => ({}))) as { authorisations?: Given[] };
        const refusal = authoriseHolders(role, role.permissions, body.authorisations ?? [], true);
        if (refusal) return refusal;
      }
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
