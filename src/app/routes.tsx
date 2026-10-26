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
import { notificationRoutes, notificationRuleRoutes } from '@/features/notifications';
import { allApprovalRoutes, approvalRoutes, delegationRoutes } from '@/features/approvals';
import { healthRoutes } from '@/features/health';
import {
  benefitRoutes,
  contractorCreateRoutes,
  contractorRoutes,
  evaluationCreateRoutes,
  evaluationRoutes,
  goalCreateRoutes,
  goalRoutes,
  leaveCreateRoutes,
  leaveRoutes,
  personCreateRoutes,
  personRoutes,
  profileCreateRoutes,
  profileRoutes,
  teamCreateRoutes,
  trainingCreateRoutes,
  trainingRoutes,
  welfareCreateRoutes,
  welfareRoutes,
  teamRoutes,
} from '@/features/workforce';
import { importRoutes } from '@/features/imports';
import { jobRoutes, scheduleRoutes } from '@/features/jobs';
import { workflowCreateRoutes, workflowEditRoutes, workflowRoutes } from '@/features/workflows';
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
              { element: <RequirePermission permission="person.create" />, children: personCreateRoutes },
              { element: <RequirePermission permission="person.view" />, children: personRoutes },
              {
                element: <RequirePermission permission="employment.create" />,
                children: profileCreateRoutes,
              },
              { element: <RequirePermission permission="employment.view" />, children: profileRoutes },
              {
                element: <RequirePermission permission="contractor.create" />,
                children: contractorCreateRoutes,
              },
              { element: <RequirePermission permission="contractor.view" />, children: contractorRoutes },
              { element: <RequirePermission permission="leave.create" />, children: leaveCreateRoutes },
              { element: <RequirePermission permission="leave.view" />, children: leaveRoutes },
              { element: <RequirePermission permission="benefit.view" />, children: benefitRoutes },
              { element: <RequirePermission permission="training.create" />, children: trainingCreateRoutes },
              { element: <RequirePermission permission="training.view" />, children: trainingRoutes },
              { element: <RequirePermission permission="welfare.create" />, children: welfareCreateRoutes },
              { element: <RequirePermission permission="welfare.view" />, children: welfareRoutes },
              { element: <RequirePermission permission="goal.create" />, children: goalCreateRoutes },
              { element: <RequirePermission permission="goal.view" />, children: goalRoutes },
              {
                element: <RequirePermission permission="evaluation.create" />,
                children: evaluationCreateRoutes,
              },
              { element: <RequirePermission permission="evaluation.view" />, children: evaluationRoutes },
              { element: <RequirePermission permission="goal.create" />, children: goalCreateRoutes },
              { element: <RequirePermission permission="goal.view" />, children: goalRoutes },
              {
                element: <RequirePermission permission="evaluation.create" />,
                children: evaluationCreateRoutes,
              },
              { element: <RequirePermission permission="evaluation.view" />, children: evaluationRoutes },
              { element: <RequirePermission permission="team.create" />, children: teamCreateRoutes },
              { element: <RequirePermission permission="team.view" />, children: teamRoutes },
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
              { element: <RequirePermission permission="workflow.view" />, children: workflowRoutes },
              { element: <RequirePermission permission="workflow.create" />, children: workflowCreateRoutes },
              { element: <RequirePermission permission="workflow.edit" />, children: workflowEditRoutes },
              { element: <RequirePermission permission="system.view" />, children: healthRoutes },
              // Everyone may import what the server offers them: it decides per type.
              ...importRoutes,
              // Everyone has their own notifications; the rules are for those who may view them.
              ...notificationRoutes,
              {
                element: <RequirePermission permission="notification.view" />,
                children: notificationRuleRoutes,
              },
              // Everyone has an approval queue (what they may decide is per item); the full list needs workflow.view.
              ...approvalRoutes,
              { element: <RequirePermission permission="workflow.view" />, children: allApprovalRoutes },
              { element: <RequirePermission permission="user.view" />, children: delegationRoutes },
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
