import { type RouteObject } from 'react-router';

/**
 * Published API of the reference feature (P1.10): the reference masters every module chooses from. One list
 * screen serves all 25; units and tea grades have their own addresses. Screens that only need to CHOOSE a
 * reference row read the selection lists from `@/lib/lookups`, not from here.
 */

/** The index of masters (lookup.view). */
export const mastersRoutes: RouteObject[] = [{ path: 'masters', lazy: () => import('./pages/MastersPage') }];
/** One master. Each has its own view permission, which the page checks. */
export const masterTypeRoutes: RouteObject[] = [
  { path: 'masters/:type', lazy: () => import('./pages/MasterPage') },
];
export const uomRoutes: RouteObject[] = [{ path: 'uoms', lazy: () => import('./pages/UomsPage') }];
export const teaGradeRoutes: RouteObject[] = [
  { path: 'tea-grades', lazy: () => import('./pages/TeaGradesPage') },
];

/** MSW mocks for VITE_MOCK_API=reference (development only; loaded on demand). */
export const loadReferenceMocks = () => import('./api/mocks');
