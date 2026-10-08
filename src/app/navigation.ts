import { type TFunction } from 'i18next';

import { type IconName, type NavItem, type NavSection } from '@/ui';

/**
 * The sidebar, as data (Spec P5 §3.3). Each entry names the permission it needs; the sidebar shows only
 * what the signed-in user holds, and the route behind it has the same guard, so hiding an entry never stands
 * in for protecting a page. Labels are translation keys in the `nav` namespace.
 */
interface AppNavItem {
  readonly id: string;
  readonly labelKey:
    | 'dashboard'
    | 'organisation'
    | 'estates'
    | 'fields'
    | 'factories'
    | 'warehouses'
    | 'parties'
    | 'users'
    | 'roles'
    | 'accessReview'
    | 'audit'
    | 'designTokens';
  readonly href: string;
  readonly icon: IconName;
  /** Backend permission code (`resource.action`); none means every signed-in user. */
  readonly permission?: string;
}

interface AppNavSection {
  readonly id: 'main' | 'organisation' | 'administration' | 'system';
  readonly items: readonly AppNavItem[];
}

export const NAVIGATION: readonly AppNavSection[] = [
  { id: 'main', items: [{ id: 'dashboard', labelKey: 'dashboard', href: '/', icon: 'home' }] },
  {
    id: 'organisation',
    items: [
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
        id: 'organisation',
        labelKey: 'organisation',
        href: '/organisation',
        icon: 'settings',
        permission: 'organisation.view',
      },
    ],
  },
  {
    id: 'administration',
    items: [
      { id: 'users', labelKey: 'users', href: '/admin/users', icon: 'users', permission: 'user.view' },
      { id: 'roles', labelKey: 'roles', href: '/admin/roles', icon: 'shield', permission: 'role.view' },
      {
        id: 'access-review',
        labelKey: 'accessReview',
        href: '/admin/access-review',
        icon: 'alert',
        permission: 'user.view',
      },
      { id: 'audit', labelKey: 'audit', href: '/admin/audit', icon: 'clipboard', permission: 'audit.view' },
    ],
  },
  {
    id: 'system',
    items: [{ id: 'design-tokens', labelKey: 'designTokens', href: '/design/tokens', icon: 'settings' }],
  },
];

/** The sidebar for this user: entries they may open, translated; sections left empty disappear. */
export function buildNavigation(
  t: TFunction<'nav'>,
  can: (permission: string | undefined) => boolean,
): NavSection[] {
  return NAVIGATION.map((section) => {
    const title = section.id === 'main' ? '' : t(`sections.${section.id}`);
    const items: NavItem[] = section.items
      .filter((item) => can(item.permission))
      .map((item) => ({ id: item.id, label: t(item.labelKey), href: item.href, icon: item.icon }));
    return { id: section.id, ...(title ? { title } : {}), items };
  }).filter((section) => section.items.length > 0);
}

/** The top bar's title: the navigation entry that owns the current path. */
export function titleFor(sections: readonly NavSection[], path: string): string | undefined {
  const items = sections.flatMap((section) => section.items);
  const match = items
    .filter(
      (item) => item.href && (item.href === path || (item.href !== '/' && path.startsWith(`${item.href}/`))),
    )
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return match?.label;
}
