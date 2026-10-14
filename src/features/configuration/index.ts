import { type RouteObject } from 'react-router';

/**
 * Published API of the configuration feature (P1.11): Admin → Document numbering and Admin → System settings.
 * Both need system.view; the app wraps them in that guard and the screens check system.create/edit/delete.
 */
export const numberingRoutes: RouteObject[] = [
  { path: 'admin/numbering', lazy: () => import('./pages/NumberingPage') },
];
export const settingsRoutes: RouteObject[] = [
  { path: 'admin/settings', lazy: () => import('./pages/SettingsPage') },
];

/** MSW mocks for VITE_MOCK_API=configuration (development only; loaded on demand). */
export const loadConfigurationMocks = () => import('./api/mocks');
