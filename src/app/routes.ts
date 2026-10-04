import { type RouteObject } from 'react-router';

import { homeRoutes } from '@/features/home';

import { RootLayout, RouteFallback } from './RootLayout';

/**
 * The route tree (data-router configuration). Every feature contributes its routes through its published
 * index, and each page is a lazy route, so it is split into its own chunk. F0.07 adds the layout shells
 * (Public, Application, Focused, Print), error routes and guards.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: RouteFallback,
    children: [...homeRoutes],
  },
];
