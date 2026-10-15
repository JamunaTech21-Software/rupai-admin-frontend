import { type TFunction } from 'i18next';

import { type IconName, type NavItem, type NavSection } from '@/ui';

/**
 * The sidebar, as data (Spec P5 §3.3; grouped as the design, R.1 and docs/redesign-spec.md §5). Each page names
 * the permission it needs; the sidebar shows only what the signed-in user holds, and the route behind it has the
 * same guard, so hiding an entry never stands in for protecting a page. A group with nothing left to show
 * disappears, and so does a section. Labels are translation keys in the `nav` namespace.
 */
type PageKey =
  | 'dashboard'
  | 'organisation'
  | 'estates'
  | 'fields'
  | 'factories'
  | 'warehouses'
  | 'parties'
  | 'seasons'
  | 'fiscalYears'
  | 'periods'
  | 'masters'
  | 'uoms'
  | 'teaGrades'
  | 'users'
  | 'roles'
  | 'accessReview'
  | 'audit'
  | 'numbering'
  | 'settings'
  | 'expiringDocuments'
  | 'jobs'
  | 'recurringJobs'
  | 'designTokens';

type GroupKey =
  'estateManagement' | 'masterData' | 'accountsFinance' | 'userAdministration' | 'configuration';

interface AppNavPage {
  readonly id: string;
  readonly labelKey: PageKey;
  readonly href: string;
  readonly icon: IconName;
  /** Backend permission code (`resource.action`); none means every signed-in user. */
  readonly permission?: string;
}

/** A group that opens to its pages (the design's "Estate Management", "Master Data", …). */
interface AppNavGroup {
  readonly id: string;
  readonly groupKey: GroupKey;
  readonly icon: IconName;
  readonly pages: readonly AppNavPage[];
}

interface AppNavSection {
  /** `main` has no heading. */
  readonly id: 'main' | 'masterData' | 'salesAccounts' | 'systemSettings';
  readonly items: readonly (AppNavPage | AppNavGroup)[];
}

export const NAVIGATION: readonly AppNavSection[] = [
  {
    id: 'main',
    items: [
      { id: 'dashboard', labelKey: 'dashboard', href: '/', icon: 'home' },
      {
        id: 'estate-management',
        groupKey: 'estateManagement',
        icon: 'map',
        pages: [
          { id: 'estates', labelKey: 'estates', href: '/estates', icon: 'leaf', permission: 'estate.view' },
          { id: 'fields', labelKey: 'fields', href: '/fields', icon: 'map', permission: 'field.view' },
          {
            id: 'factories',
            labelKey: 'factories',
            href: '/factories',
            icon: 'factory',
            permission: 'factory.view',
          },
          {
            id: 'warehouses',
            labelKey: 'warehouses',
            href: '/warehouses',
            icon: 'package',
            permission: 'warehouse.view',
          },
          { id: 'parties', labelKey: 'parties', href: '/parties', icon: 'user', permission: 'land.view' },
          {
            id: 'expiring-documents',
            labelKey: 'expiringDocuments',
            href: '/documents/expiring',
            icon: 'file',
            permission: 'document.view',
          },
        ],
      },
    ],
  },
  {
    id: 'masterData',
    items: [
      {
        id: 'master-data',
        groupKey: 'masterData',
        icon: 'database',
        pages: [
          {
            id: 'masters',
            labelKey: 'masters',
            href: '/masters',
            icon: 'folderOpen',
            permission: 'lookup.view',
          },
          { id: 'uoms', labelKey: 'uoms', href: '/uoms', icon: 'ruler', permission: 'uom.view' },
          {
            id: 'tea-grades',
            labelKey: 'teaGrades',
            href: '/tea-grades',
            icon: 'tag',
            permission: 'tea_grade.view',
          },
          {
            id: 'seasons',
            labelKey: 'seasons',
            href: '/seasons',
            icon: 'calendar',
            permission: 'season.view',
          },
        ],
      },
    ],
  },
  {
    id: 'salesAccounts',
    items: [
      {
        id: 'accounts-finance',
        groupKey: 'accountsFinance',
        icon: 'calculator',
        pages: [
          {
            id: 'fiscal-years',
            labelKey: 'fiscalYears',
            href: '/fiscal-years',
            icon: 'wallet',
            permission: 'fiscal_year.view',
          },
          {
            id: 'accounting-periods',
            labelKey: 'periods',
            href: '/accounting-periods',
            icon: 'clock',
            permission: 'accounting_period.view',
          },
        ],
      },
    ],
  },
  {
    id: 'systemSettings',
    items: [
      {
        id: 'user-administration',
        groupKey: 'userAdministration',
        icon: 'users',
        pages: [
          { id: 'users', labelKey: 'users', href: '/admin/users', icon: 'users', permission: 'user.view' },
          { id: 'roles', labelKey: 'roles', href: '/admin/roles', icon: 'shield', permission: 'role.view' },
          {
            id: 'access-review',
            labelKey: 'accessReview',
            href: '/admin/access-review',
            icon: 'alert',
            permission: 'user.view',
          },
          {
            id: 'audit',
            labelKey: 'audit',
            href: '/admin/audit',
            icon: 'clipboard',
            permission: 'audit.view',
          },
        ],
      },
      {
        id: 'configuration',
        groupKey: 'configuration',
        icon: 'settings',
        pages: [
          {
            id: 'organisation',
            labelKey: 'organisation',
            href: '/organisation',
            icon: 'settings',
            permission: 'organisation.view',
          },
          {
            id: 'numbering',
            labelKey: 'numbering',
            href: '/admin/numbering',
            icon: 'hash',
            permission: 'system.view',
          },
          {
            id: 'settings',
            labelKey: 'settings',
            href: '/admin/settings',
            icon: 'sliders',
            permission: 'system.view',
          },
          { id: 'jobs', labelKey: 'jobs', href: '/jobs', icon: 'clock' },
          {
            id: 'recurring-jobs',
            labelKey: 'recurringJobs',
            href: '/admin/schedules',
            icon: 'refresh',
            permission: 'system.view',
          },
          { id: 'design-tokens', labelKey: 'designTokens', href: '/design/tokens', icon: 'settings' },
        ],
      },
    ],
  },
];

const isGroup = (item: AppNavPage | AppNavGroup): item is AppNavGroup => 'pages' in item;

/** The sidebar for this user: entries they may open, translated; empty groups and sections disappear. */
export function buildNavigation(
  t: TFunction<'nav'>,
  can: (permission: string | undefined) => boolean,
): NavSection[] {
  const page = (item: AppNavPage): NavItem => ({
    id: item.id,
    label: t(item.labelKey),
    href: item.href,
    icon: item.icon,
  });
  return NAVIGATION.map((section) => {
    const title = section.id === 'main' ? '' : t(`sections.${section.id}`);
    const items = section.items.flatMap((item): NavItem[] => {
      if (!isGroup(item)) return can(item.permission) ? [page(item)] : [];
      const children = item.pages.filter((p) => can(p.permission)).map(page);
      return children.length > 0
        ? [{ id: item.id, label: t(`groups.${item.groupKey}`), icon: item.icon, children }]
        : [];
    });
    return { id: section.id, ...(title ? { title } : {}), items };
  }).filter((section) => section.items.length > 0);
}

/** Every page in the sidebar, groups opened. */
export function navigationPages(sections: readonly NavSection[]): NavItem[] {
  const flat = (items: readonly NavItem[]): NavItem[] =>
    items.flatMap((item) => [item, ...flat(item.children ?? [])]);
  return sections.flatMap((section) => flat(section.items));
}

/** The top bar's title: the navigation entry that owns the current path. */
export function titleFor(sections: readonly NavSection[], path: string): string | undefined {
  const match = navigationPages(sections)
    .filter(
      (item) => item.href && (item.href === path || (item.href !== '/' && path.startsWith(`${item.href}/`))),
    )
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return match?.label;
}
