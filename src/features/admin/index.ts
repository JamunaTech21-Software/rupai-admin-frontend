import { type RouteObject } from 'react-router';

/**
 * Published API of the admin feature (P1.01). Pages are lazy, so each is its own chunk; the app wraps each
 * group in the permission guard it needs.
 */
export const adminUserRoutes: RouteObject[] = [
  { path: 'admin/users', lazy: () => import('./pages/UsersPage') },
  { path: 'admin/users/:id', lazy: () => import('./pages/UserDetailPage') },
];
export const adminUserCreateRoutes: RouteObject[] = [
  { path: 'admin/users/new', lazy: () => import('./pages/UserCreatePage') },
];
/** Admin → Audit (P1.05): changes and access log; needs audit.view. */
export const adminAuditRoutes: RouteObject[] = [
  { path: 'admin/audit', lazy: () => import('./pages/AuditPage') },
];

/** The access review (concentration report, P1.04): needs user.view. */
export const adminAccessReviewRoutes: RouteObject[] = [
  { path: 'admin/access-review', lazy: () => import('./pages/AccessReviewPage') },
];
export const adminRoleRoutes: RouteObject[] = [
  { path: 'admin/roles', lazy: () => import('./pages/RolesPage') },
  { path: 'admin/roles/:id', lazy: () => import('./pages/RoleEditorPage') },
];
export const adminRoleCreateRoutes: RouteObject[] = [
  { path: 'admin/roles/new', lazy: () => import('./pages/RoleEditorPage') },
];

/** MSW mocks for VITE_MOCK_API=admin (development only; loaded on demand). */
export const loadAdminMocks = () => import('./api/mocks');
