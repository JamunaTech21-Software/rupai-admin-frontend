/**
 * Published API of the system feature: app-wide pieces every screen relies on — the environment banner, the
 * conflict dialog, running jobs, the five page states — and the system mocks (health endpoints).
 */
export { EnvironmentBanner } from './components/EnvironmentBanner';
export { ConflictDialogHost } from './components/ConflictDialogHost';
export { RunningJobs } from './components/RunningJobs';
export {
  ForbiddenState,
  NotFoundState,
  PageEmpty,
  type PageEmptyProps,
  PageError,
  type PageErrorProps,
  PageLoading,
  PermissionNotice,
  RefusalDialog,
  type RefusalDialogProps,
} from './components/PageStates';

/** Loaded only when this feature is mocked (VITE_MOCK_API), so MSW never reaches the production bundle. */
export const loadSystemMocks = () => import('./api/mocks');
