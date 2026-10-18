import { type RouteObject } from 'react-router';

/** Published API of the health feature (P1.18): Configuration → System health, for those with system.view. */
export const healthRoutes: RouteObject[] = [
  { path: 'admin/health', lazy: () => import('./pages/HealthPage') },
];

/** MSW mocks for VITE_MOCK_API=health (development only; loaded on demand). */
export const loadHealthMocks = () => import('./api/mocks');
