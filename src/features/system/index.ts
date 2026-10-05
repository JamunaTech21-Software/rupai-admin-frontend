/**
 * Published API of the system feature: the environment banner and the system mocks (health endpoints).
 */
export { EnvironmentBanner } from './components/EnvironmentBanner';

/** Loaded only when this feature is mocked (VITE_MOCK_API), so MSW never reaches the production bundle. */
export const loadSystemMocks = () => import('./api/mocks');
