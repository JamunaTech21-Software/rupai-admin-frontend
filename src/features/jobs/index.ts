import { type RouteObject } from 'react-router';

/**
 * Published API of the jobs feature (P1.15): the running-jobs indicator for the top bar, the Jobs list and one job
 * (any signed-in user sees their own), and the recurring jobs admin page (system.view). Following a job that a
 * screen started is `useJob` in `@/lib/query`.
 */
export { RunningJobs } from './components/RunningJobs';

export const jobRoutes: RouteObject[] = [
  { path: 'jobs', lazy: () => import('./pages/JobsPage') },
  { path: 'jobs/:id', lazy: () => import('./pages/JobPage') },
];
export const scheduleRoutes: RouteObject[] = [
  { path: 'admin/schedules', lazy: () => import('./pages/SchedulesPage') },
];

/** MSW mocks for VITE_MOCK_API=jobs (development only; loaded on demand). */
export const loadJobsMocks = () => import('./api/mocks');
