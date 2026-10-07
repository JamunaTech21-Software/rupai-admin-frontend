import { type RouteObject } from 'react-router';

/**
 * Published API of the auth feature: the sign-in and password screens (P1.02). The session itself
 * (AuthProvider, <Can>, usePermission) lives in lib/auth, because every feature uses it.
 */

/** Public routes, shown in the Public layout without a session. */
export const publicAuthRoutes: RouteObject[] = [
  { path: 'login', lazy: () => import('./pages/LoginPage') },
  { path: 'forgot-password', lazy: () => import('./pages/ForgotPasswordPage') },
  { path: 'reset-password', lazy: () => import('./pages/ResetPasswordPage') },
];

/** Needs a session, but no permission: shown in the Focused layout. */
export const changePasswordRoute: RouteObject = {
  path: 'change-password',
  lazy: () => import('./pages/ChangePasswordPage'),
};

/** Your account: profile and signed-in devices. Needs a session, no permission; in the Application layout. */
export const accountRoutes: RouteObject[] = [{ path: 'account', lazy: () => import('./pages/AccountPage') }];

export { loginPathFor, safeReturnTo } from './returnTo';
