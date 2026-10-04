import { Outlet } from 'react-router';

export function RootLayout() {
  return <Outlet />;
}

/** Shown while the first lazy route chunk loads. */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center text-slate-600"
    >
      Loading…
    </div>
  );
}
