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
  | 'persons'
  | 'workers'
  | 'employees'
  | 'teams'
  | 'contractors'
  | 'leaveRequests'
  | 'leaveBalances'
  | 'benefits'
  | 'welfare'
  | 'training'
  | 'goals'
  | 'evaluations'
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
  | 'approvals'
  | 'allApprovals'
  | 'approvalExceptions'
  | 'workflows'
  | 'imports'
  | 'systemHealth'
  | 'notificationRules'
  | 'delegations'
  | 'designTokens';

type GroupKey =
  | 'estateManagement'
  | 'workforce'
  | 'hr'
  | 'masterData'
  | 'accountsFinance'
  | 'userAdministration'
  | 'configuration';

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
      { id: 'approvals', labelKey: 'approvals', href: '/approvals', icon: 'clipboard' },
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
      {
        id: 'workforce',
        groupKey: 'workforce',
        icon: 'users',
        pages: [
          {
            id: 'persons',
            labelKey: 'persons',
            href: '/workforce/persons',
            icon: 'user',
            permission: 'person.view',
          },
          {
            id: 'workers',
            labelKey: 'workers',
            href: '/workforce/workers',
            icon: 'users',
            permission: 'employment.view',
          },
          {
            id: 'employees',
            labelKey: 'employees',
            href: '/workforce/employees',
            icon: 'user',
            permission: 'employment.view',
          },
          {
            id: 'teams',
            labelKey: 'teams',
            href: '/workforce/teams',
            icon: 'users',
            permission: 'team.view',
          },
          {
            id: 'contractors',
            labelKey: 'contractors',
            href: '/workforce/contractors',
            icon: 'user',
            permission: 'contractor.view',
          },
        ],
      },
      {
        id: 'hr',
        groupKey: 'hr',
        icon: 'calendar',
        pages: [
          {
            id: 'leave-requests',
            labelKey: 'leaveRequests',
            href: '/hr/leave',
            icon: 'calendar',
            permission: 'leave.view',
          },
          {
            id: 'leave-balances',
            labelKey: 'leaveBalances',
            href: '/hr/leave/balances',
            icon: 'clock',
            permission: 'leave.view',
          },
          {
            id: 'benefits',
            labelKey: 'benefits',
            href: '/hr/benefits',
            icon: 'package',
            permission: 'benefit.view',
          },
          {
            id: 'welfare',
            labelKey: 'welfare',
            href: '/hr/welfare',
            icon: 'users',
            permission: 'welfare.view',
          },
          {
            id: 'training',
            labelKey: 'training',
            href: '/hr/training',
            icon: 'clipboard',
            permission: 'training.view',
          },
          {
            id: 'goals',
            labelKey: 'goals',
            href: '/hr/goals',
            icon: 'chart',
            permission: 'goal.view',
          },
          {
            id: 'evaluations',
            labelKey: 'evaluations',
            href: '/hr/evaluations',
            icon: 'checkCircle',
            permission: 'evaluation.view',
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
            id: 'delegations',
            labelKey: 'delegations',
            href: '/approvals/delegations',
            icon: 'users',
            permission: 'user.view',
          },
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
            id: 'workflows',
            labelKey: 'workflows',
            href: '/admin/workflows',
            icon: 'sliders',
            permission: 'workflow.view',
          },
          {
            id: 'notification-rules',
            labelKey: 'notificationRules',
            href: '/admin/notification-rules',
            icon: 'bell',
            permission: 'notification.view',
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
          {
            id: 'all-approvals',
            labelKey: 'allApprovals',
            href: '/approvals/all',
            icon: 'inbox',
            permission: 'workflow.view',
          },
          {
            id: 'approval-exceptions',
            labelKey: 'approvalExceptions',
            href: '/approvals/exceptions',
            icon: 'alert',
            permission: 'workflow.view',
          },
          {
            id: 'system-health',
            labelKey: 'systemHealth',
            href: '/admin/health',
            icon: 'monitor',
            permission: 'system.view',
          },
          { id: 'imports', labelKey: 'imports', href: '/imports', icon: 'upload' },
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
