import { Link } from 'react-router';

import { useTranslation } from '@/lib/i18n';

export type EstateTab = 'profile' | 'divisions' | 'fields';

/**
 * The Estate Management tab bar of the design (R.2, R.3): one estate's pages. Only pages that exist are shown;
 * Map & GIS and Land & Lease join when their modules exist.
 */
export function EstateTabs({
  estateId,
  current,
}: {
  readonly estateId: string;
  readonly current: EstateTab;
}) {
  const { t } = useTranslation('org');
  const tabs: readonly { id: EstateTab; label: string; href: string }[] = [
    { id: 'profile', label: t('profile.tabs.profile'), href: `/estates/${estateId}` },
    { id: 'divisions', label: t('profile.tabs.divisions'), href: `/estates/${estateId}/divisions` },
    { id: 'fields', label: t('profile.tabs.fields'), href: `/estates/${estateId}/fields` },
  ];
  return (
    <nav
      aria-label={t('profile.tabs.label')}
      className="rounded-lg border border-line bg-surface p-2 shadow-sm"
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {tabs.map((tab, index) => {
          const isCurrent = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                to={tab.href}
                {...(isCurrent ? { 'aria-current': 'page' as const } : {})}
                className={
                  isCurrent
                    ? 'flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-3 text-sm font-semibold text-fg-on-primary shadow-md'
                    : 'flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-3 text-sm font-semibold text-fg hover:border-primary hover:bg-primary-subtle hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
                }
              >
                {`${String(index + 1)}. ${tab.label}`}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
