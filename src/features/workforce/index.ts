import { type RouteObject } from 'react-router';

/**
 * Published API of the workforce feature (P2.01): the person registry under Workforce → Persons. Pages are lazy;
 * the app wraps each group in the permission guard it needs.
 */
export const personRoutes: RouteObject[] = [
  { path: 'workforce/persons', lazy: () => import('./pages/PersonsPage') },
  { path: 'workforce/persons/:id', lazy: () => import('./pages/PersonPage') },
];
/** Workers, employees and the combined list (P2.02), and one profile. */
export const profileRoutes: RouteObject[] = [
  {
    path: 'workforce/workers',
    lazy: async () => ({ Component: (await import('./pages/ProfilesPage')).WorkersPage }),
  },
  {
    path: 'workforce/employees',
    lazy: async () => ({ Component: (await import('./pages/ProfilesPage')).EmployeesPage }),
  },
  {
    path: 'workforce/profiles',
    lazy: async () => ({ Component: (await import('./pages/ProfilesPage')).AllProfilesPage }),
  },
  { path: 'workforce/profiles/:id', lazy: () => import('./pages/ProfilePage') },
];
export const profileCreateRoutes: RouteObject[] = [
  { path: 'workforce/profiles/new', lazy: () => import('./pages/ProfilePage') },
];
export const personCreateRoutes: RouteObject[] = [
  { path: 'workforce/persons/new', lazy: () => import('./pages/PersonPage') },
];

/** MSW mocks for VITE_MOCK_API=workforce (development only; loaded on demand). */
export const loadWorkforceMocks = () => import('./api/mocks');
