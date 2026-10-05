import { Outlet, useLocation } from 'react-router';

import { EnvironmentBanner } from '@/features/system';
import { usePermissionCheck } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { AppShell, Button } from '@/ui';

import { buildNavigation, titleFor } from './navigation';
import { LanguageSwitch, TopBarActions } from './TopBarActions';

/**
 * The four layout shells (Spec P5 §3.2). Every route renders inside exactly one:
 *
 * - Public: no session; a centred card (sign in, forgot and reset password)
 * - Application: the app frame with sidebar and top bar (almost every screen)
 * - Focused: a session but no navigation, for one task that must be finished (change a temporary password,
 *   later multi-step wizards)
 * - Print: no chrome at all, for printable documents
 */

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <EnvironmentBanner />
      <div className="flex justify-end p-3">
        <LanguageSwitch />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function ApplicationLayout() {
  const { t } = useTranslation('nav');
  const { t: tc } = useTranslation('common');
  const can = usePermissionCheck();
  const { pathname } = useLocation();
  const navigation = buildNavigation(t, can);
  const title = titleFor(navigation, pathname);

  return (
    <AppShell
      brand={{ name: tc('appName'), tagline: tc('tagline'), logoSrc: '/logo.png' }}
      navigation={navigation}
      currentPath={pathname}
      {...(title ? { title } : {})}
      banner={<EnvironmentBanner />}
      topBarActions={<TopBarActions />}
    >
      <Outlet />
    </AppShell>
  );
}

export function FocusedLayout() {
  const { t } = useTranslation('common');
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <EnvironmentBanner />
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        <span className="flex items-center gap-2 font-semibold text-primary-strong">
          <img src="/logo.png" alt="" width={28} height={28} className="size-7" />
          {t('appName')}
        </span>
        <LanguageSwitch />
      </header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function PrintLayout() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-dvh bg-surface">
      <div className="flex justify-end p-3 print:hidden">
        <Button
          variant="secondary"
          size="sm"
          iconStart="file"
          onPress={() => {
            window.print();
          }}
        >
          {t('print')}
        </Button>
      </div>
      <main className="mx-auto max-w-4xl px-8 pb-8 print:max-w-none print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
