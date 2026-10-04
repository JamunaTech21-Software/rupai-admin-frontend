import { type RouteObject } from 'react-router';

/**
 * Published API of the home feature. Other code imports this feature only through this file
 * (`@/features/home`). It stays light: pages are referenced lazily, so each is its own chunk.
 */
export const homeRoutes: RouteObject[] = [{ index: true, lazy: () => import('./pages/HomePage') }];
