import { type RouteObject } from 'react-router';

import {
  adminAccessReviewRoutes,
  adminAuditRoutes,
  adminRoleCreateRoutes,
  adminRoleRoutes,
  adminUserCreateRoutes,
  adminUserRoutes,
} from '@/features/admin';
import { numberingRoutes, settingsRoutes } from '@/features/configuration';
import { accountRoutes, changePasswordRoute, publicAuthRoutes } from '@/features/auth';
import { designSystemRoutes } from '@/features/design-system';
import { expiringDocumentsRoutes } from '@/features/documents';
import { homeRoutes } from '@/features/home';
import { jobRoutes, scheduleRoutes } from '@/features/jobs';
import {
  estateCreateRoutes,
  estateRoutes,
  factoryCreateRoutes,
  factoryRoutes,
  fieldCreateRoutes,
  fieldRoutes,
  fiscalYearRoutes,
  organisationRoutes,
  partyCreateRoutes,
  partyRoutes,
  periodRoutes,
  seasonCreateRoutes,
  seasonRoutes,
  warehouseCreateRoutes,
  warehouseRoutes,
} from '@/features/organisation';

import { masterTypeRoutes, mastersRoutes, teaGradeRoutes, uomRoutes } from '@/features/reference';
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
              { element: <RequirePermission permission="organisation.view" />, children: organisationRoutes },
              { element: <RequirePermission permission="estate.create" />, children: estateCreateRoutes },
              { element: <RequirePermission permission="estate.view" />, children: estateRoutes },
              { element: <RequirePermission permission="field.create" />, children: fieldCreateRoutes },
              { element: <RequirePermission permission="field.view" />, children: fieldRoutes },
              { element: <RequirePermission permission="factory.create" />, children: factoryCreateRoutes },
              { element: <RequirePermission permission="factory.view" />, children: factoryRoutes },
              {
                element: <RequirePermission permission="warehouse.create" />,
                children: warehouseCreateRoutes,
              },
              { element: <RequirePermission permission="warehouse.view" />, children: warehouseRoutes },
              { element: <RequirePermission permission="land.create" />, children: partyCreateRoutes },
              { element: <RequirePermission permission="land.view" />, children: partyRoutes },
              { element: <RequirePermission permission="season.create" />, children: seasonCreateRoutes },
              { element: <RequirePermission permission="season.view" />, children: seasonRoutes },
              { element: <RequirePermission permission="fiscal_year.view" />, children: fiscalYearRoutes },
              {
                element: <RequirePermission permission="accounting_period.view" />,
                children: periodRoutes,
              },
              {
                element: <RequirePermission permission="document.view" />,
                children: expiringDocumentsRoutes,
              },
              // Everyone sees their own jobs; the recurring jobs page is for those who may view the system.
              ...jobRoutes,
              { element: <RequirePermission permission="system.view" />, children: scheduleRoutes },
              { element: <RequirePermission permission="lookup.view" />, children: mastersRoutes },
              // Each master has its own view permission: the page checks it.
              ...masterTypeRoutes,
              { element: <RequirePermission permission="uom.view" />, children: uomRoutes },
              { element: <RequirePermission permission="tea_grade.view" />, children: teaGradeRoutes },
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
              { element: <RequirePermission permission="system.view" />, children: numberingRoutes },
              { element: <RequirePermission permission="system.view" />, children: settingsRoutes },
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
