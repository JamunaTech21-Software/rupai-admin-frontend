import { Outlet, useHref, useNavigate } from 'react-router';

import { EnvironmentBanner } from '@/features/system';
import { UiProvider } from '@/ui';

export function RootLayout() {
  const navigate = useNavigate();
  return (
    <UiProvider
      navigate={(path) => {
        void navigate(path);
      }}
      useHref={useHref}
    >
      <EnvironmentBanner />
      <Outlet />
    </UiProvider>
  );
}

/** Shown while the first lazy route chunk loads. */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center text-fg-muted"
    >
      Loading…
    </div>
  );
}
