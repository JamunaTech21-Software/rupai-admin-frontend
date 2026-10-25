import { type RouteObject } from 'react-router';

/**
 * Published API of the workforce feature (P2.01): the person registry under Workforce → Persons. Pages are lazy;
 * the app wraps each group in the permission guard it needs.
 */
export const personRoutes: RouteObject[] = [
  { path: 'workforce/persons', lazy: () => import('./pages/PersonsPage') },
  { path: 'workforce/persons/:id', lazy: () => import('./pages/PersonPage') },
];
export const personCreateRoutes: RouteObject[] = [
  { path: 'workforce/persons/new', lazy: () => import('./pages/PersonPage') },
];

/** MSW mocks for VITE_MOCK_API=workforce (development only; loaded on demand). */
export const loadWorkforceMocks = () => import('./api/mocks');
