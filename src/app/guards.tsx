import { Navigate, Outlet, useLocation } from 'react-router';

import { loginPathFor } from '@/features/auth';
import { ForbiddenState } from '@/features/system';
import { useAuth, usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { Spinner } from '@/ui';

/** While the session starts (refresh → /auth/me → lookups): one calm screen, announced. */
export function StartingScreen() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas text-fg-muted">
      <img src="/logo.png" alt="" width={48} height={48} className="size-12" />
      <Spinner label={t('starting')} />
    </div>
  );
}

/**
 * Protected routes (Spec P5 §3.5). Without a session the user goes to sign in, with the page they asked for
 * as `returnTo`. A temporary password must be changed before anything else.
 */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;

  if (state.status === 'loading') return <StartingScreen />;
  if (state.status === 'signed-out') return <Navigate to={loginPathFor(here)} replace />;
  if (state.me.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to={`/change-password?returnTo=${encodeURIComponent(here)}`} replace />;
  }
  return <Outlet />;
}

/**
 * Route-level permission guard. The address stays, and the page says the user has no access (403), so a
 * bookmarked link explains itself instead of bouncing somewhere else.
 */
export function RequirePermission({ permission }: { readonly permission: string }) {
  return usePermission(permission) ? <Outlet /> : <ForbiddenState />;
}
