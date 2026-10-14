import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Outlet, useHref, useNavigate } from 'react-router';

import { ConflictDialogHost } from '@/features/system';
import { type ApiClient } from '@/lib/api';
import { AuthProvider, hasPermission, type Me } from '@/lib/auth';
import { useLanguage, useTranslation } from '@/lib/i18n';
import { primeLookups } from '@/lib/lookups';
import { QueryProvider } from '@/lib/query';
import { UiProvider } from '@/ui';

import { buildUiText } from './uiText';

/** The component library, connected to the router and speaking the active language. */
function UiBridge({ children }: { readonly children: React.ReactNode }) {
  const navigate = useNavigate();
  const { t } = useTranslation('ui');
  const language = useLanguage();
  const text = useMemo(() => buildUiText(t, language), [t, language]);
  return (
    <UiProvider
      navigate={(path) => {
        void navigate(path);
      }}
      useHref={useHref}
      text={text}
    >
      {children}
    </UiProvider>
  );
}

/** The session, with the reference lists (P1.10) loaded before the app renders for those who may read them. */
function Session({ children }: { readonly children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const loadLookups = useCallback(
    async (client: ApiClient, me: Me) => {
      if (hasPermission(me.permissions, 'lookup.view')) await primeLookups(queryClient, client);
    },
    [queryClient],
  );
  return <AuthProvider loadLookups={loadLookups}>{children}</AuthProvider>;
}

/**
 * The root of every route: data layer, component library and session. The session starts here (refresh →
 * /auth/me → lookups); the routes below decide what a signed-out user may see.
 */
export function RootLayout() {
  return (
    <QueryProvider>
      <UiBridge>
        <Session>
          <Outlet />
          <ConflictDialogHost />
        </Session>
      </UiBridge>
    </QueryProvider>
  );
}

/** Shown while the first lazy route chunk loads. */
export function RouteFallback() {
  const { t } = useTranslation('common');
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center text-fg-muted"
    >
      {t('loadingPage')}
    </div>
  );
}
