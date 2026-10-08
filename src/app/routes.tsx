import { type RouteObject } from 'react-router';

import {
  adminAccessReviewRoutes,
  adminAuditRoutes,
  adminRoleCreateRoutes,
  adminRoleRoutes,
  adminUserCreateRoutes,
  adminUserRoutes,
} from '@/features/admin';
import { accountRoutes, changePasswordRoute, publicAuthRoutes } from '@/features/auth';
import { designSystemRoutes } from '@/features/design-system';
import { homeRoutes } from '@/features/home';

import { ForbiddenPage, NotFoundPage, RouteError, ServerErrorPage } from './errors';
import { RequireAuth, RequirePermission } from './guards';
import { ApplicationLayout, FocusedLayout, PrintLayout, PublicLayout } from './layouts';
import { RootLayout, RouteFallback } from './RootLayout';

/**
 * Gives every route its own error boundary (Spec P5 §3.2): a render error or failed loader is shown in place
 * of that one route, inside its layout, and the rest of the app keeps working.
 */
export function contained(routes: readonly RouteObject[]): RouteObject[] {
  return routes.map((route) => {
    const children = route.children ? contained(route.children) : undefined;
    return {
      ...route,
      ...(route.errorElement === undefined ? { errorElement: <RouteError /> } : {}),
      ...(children ? { children } : {}),
    } as RouteObject;
  });
}

/**
 * The route tree (Spec P5 §3.2). Each feature contributes routes through its published index; every page is
 * lazy, so it is its own chunk.
 *
 *   /                      RootLayout: data layer, ui, session
 *   ├─ Public              login, forgot-password, reset-password
 *   └─ RequireAuth         no session → /login?returnTo=…; temporary password → change it first
 *      ├─ Focused          change-password
 *      ├─ Print            print/… (printable documents, added by modules)
 *      └─ Application      the app frame: dashboard, screens, 403/404/500
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
    children: contained([
      { Component: PublicLayout, children: publicAuthRoutes },
      {
        Component: RequireAuth,
        children: [
          { Component: FocusedLayout, children: [changePasswordRoute] },
          { path: 'print', Component: PrintLayout, children: [] },
          {
            Component: ApplicationLayout,
            children: [
              ...homeRoutes,
              ...accountRoutes,
              ...designSystemRoutes,
              {
                element: <RequirePermission permission="user.view" />,
                children: adminUserRoutes,
              },
              { element: <RequirePermission permission="user.create" />, children: adminUserCreateRoutes },
              { element: <RequirePermission permission="user.view" />, children: adminAccessReviewRoutes },
              {
                element: <RequirePermission permission="role.view" />,
                children: adminRoleRoutes,
              },
              { element: <RequirePermission permission="role.create" />, children: adminRoleCreateRoutes },
              {
                element: <RequirePermission permission="audit.view" />,
                children: adminAuditRoutes,
              },
              { path: 'forbidden', Component: ForbiddenPage },
              { path: 'error', Component: ServerErrorPage },
              { path: '*', Component: NotFoundPage },
            ],
          },
        ],
      },
    ]),
  },
];
