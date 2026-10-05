import { type RequestHandler } from 'msw';

import { loadSystemMocks } from '@/features/system';
import { isFeatureMocked, type MockSetting, mockSetting } from '@/lib/mocks';

/**
 * Every feature that has mocks, by the name used in VITE_MOCK_API. Add a feature here when it gets
 * `api/mocks.ts`; remove it (or just stop listing it in VITE_MOCK_API) once its backend is live.
 */
const FEATURE_MOCKS: Record<string, () => Promise<{ handlers: RequestHandler[] }>> = {
  system: loadSystemMocks,
  // Contract mocks from lib (F0.06): demo sign-in (manager / viewer) and background jobs.
  auth: () => import('@/lib/mocking/contract').then((m) => ({ handlers: m.authMocks() })),
  jobs: () => import('@/lib/mocking/contract').then((m) => ({ handlers: m.jobMocks() })),
};

/**
 * Starts MSW in the browser for the mocked features only. Unmocked requests pass through to the real backend
 * (via the Vite proxy), so one screen can mix live and mocked endpoints. Does nothing outside development.
 */
export async function startMocking(setting: MockSetting = mockSetting): Promise<void> {
  if (!import.meta.env.DEV || setting.kind === 'none') return;

  const names = Object.keys(FEATURE_MOCKS).filter((name) => isFeatureMocked(setting, name));
  const modules = await Promise.all(
    names.map((name) => FEATURE_MOCKS[name]?.() ?? Promise.resolve({ handlers: [] })),
  );
  const handlers = modules.flatMap((module) => module.handlers);
  if (handlers.length === 0) return;

  const { setupWorker } = await import('msw/browser');
  await setupWorker(...handlers).start({ onUnhandledFrame: 'bypass', quiet: true });
  // A developer-facing note in the console, so it is obvious which answers are fake.
  // eslint-disable-next-line no-console -- development only
  console.info(`[mocks] Mocked features: ${names.join(', ')}. Everything else goes to the backend.`);
}
