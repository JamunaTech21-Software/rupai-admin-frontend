import { type RouteObject } from 'react-router';

/**
 * Published API of the design-system feature: reference pages for the design tokens (F0.02). The component
 * workspace (F0.03) will show the same reference next to every component.
 */
export const designSystemRoutes: RouteObject[] = [
  { path: 'design/tokens', lazy: () => import('./pages/TokensPage') },
];
