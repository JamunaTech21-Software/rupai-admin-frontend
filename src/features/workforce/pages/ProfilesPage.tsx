import { ImportButton } from '@/features/imports';
import { ScopeNotice, useAllEstates, useEstateSections } from '@/features/organisation';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { type LookupType, lookupText, useActiveLookups } from '@/lib/lookups';
import { filterKey } from '@/lib/urlState';
import {
  Button,
  ButtonLink,
  type DataColumn,
  DataTable,
  EmptyState,
  Input,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { useProfilesList, useWorkforceSummary } from '../api/profiles';
import {
  EMPLOYMENT_TYPES,
  ENGAGEMENT_TYPES,
  type EmploymentType,
  PROFILE_STATUSES,
  type Profile,
} from '../api/profileSchemas';
import { PersonAvatar } from '../components/PersonAvatar';
import { ProfileStatusBadge } from '../components/ProfileActions';
import { Breakdowns, Celebrations, SummaryCards } from '../components/WorkforceOverview';

const SEARCH = filterKey('q');
const ESTATE = filterKey('estate_id');
const TYPE = filterKey('employment_type');
const CATEGORY = filterKey('category_id');
const ENGAGEMENT = filterKey('engagement_type');
const STATUS = filterKey('status');
const DEPARTMENT = filterKey('department_id');
const DESIGNATION = filterKey('designation_id');
const SECTION = filterKey('section_id');

/**
 * Workforce → Workers / Employees / Profiles (P2.02): the manager's Worker and Employee Management pages. The cards
 * and charts count what the filters (garden, and the type of the page) select; the list below has the rest. The
 * department, designation and section columns come from the assignment (P2.03).
 */
export function ProfilesPage({ type }: { readonly type?: EmploymentType }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('employment.create');
  const list = useProfilesList(type);
  const estates = useAllEstates();
  const { table } = list;
  const shownType = type ?? EMPLOYMENT_TYPES.find((value) => value === table.filters[TYPE]) ?? undefined;
  const summary = useWorkforceSummary(shownType, table.filters[ESTATE]);
  const categoryType: LookupType = shownType === 'employee' ? 'employee_category' : 'worker_category';
  const canRead = usePermission('lookup.view');
  const categories = useActiveLookups(categoryType, canRead && shownType !== undefined);
  const departments = useActiveLookups('department', canRead);
  const designations = useActiveLookups('designation', canRead);
  const estateId = table.filters[ESTATE] ?? '';
  const sections = useEstateSections(estateId);
  const noun = type === 'worker' ? 'workers' : type === 'employee' ? 'employees' : 'people';
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Profile>[] = [
    {
      id: 'sl',
      header: t('profiles.columns.sl'),
      isNumeric: true,
      cell: (p) => format.number(list.rows.indexOf(p) + 1 + (table.page - 1) * table.pageSize),
    },
    {
      id: 'profile_number',
      header: t(`profiles.columns.id.${type ?? 'any'}`),
      isSortable: true,
      cell: (p) => (
        <Link href={`/workforce/profiles/${p.id}`} className="font-mono">
          {p.profile_number}
        </Link>
      ),
    },
    {
      id: 'photo',
      header: t('profiles.columns.photo'),
      canHide: true,
      cell: (p) => (
        <PersonAvatar name={p.person.full_name} photoDocumentId={p.person.photo_document_id} size="sm" />
      ),
    },
    {
      id: 'name',
      header: t(`profiles.columns.name.${type ?? 'any'}`),
      cell: (p) => <span className="font-medium">{p.person.full_name}</span>,
    },
    {
      id: 'father',
      header: t('profiles.columns.father'),
      canHide: true,
      cell: (p) => p.person.father_name ?? none,
    },
    {
      id: 'type',
      header: t('profiles.columns.type'),
      canHide: true,
      isHiddenByDefault: type !== undefined,
      cell: (p) => t(`employmentTypes.${p.employment_type}`),
    },
    {
      id: 'category',
      header: t('profiles.columns.category'),
      canHide: true,
      cell: (p) => p.category?.name ?? none,
    },
    {
      id: 'designation',
      header: t('profiles.columns.designation'),
      canHide: true,
      isHiddenByDefault: type !== 'employee',
      cell: (p) => p.current_assignment?.designation?.name ?? none,
    },
    {
      id: 'section',
      header: t('profiles.columns.section'),
      canHide: true,
      cell: (p) => p.current_assignment?.section?.name ?? none,
    },
    { id: 'phone', header: t('profiles.columns.phone'), canHide: true, cell: (p) => p.person.phone ?? none },
    {
      id: 'joining_date',
      header: t('profiles.columns.joined'),
      isSortable: true,
      canHide: true,
      cell: (p) => format.date(p.joining_date),
    },
    {
      id: 'status',
      header: t('profiles.columns.status'),
      align: 'center',
      cell: (p) => <ProfileStatusBadge status={p.status} />,
    },
    {
      id: 'actions',
      header: t('profiles.columns.actions'),
      cell: (p) => (
        <Link href={`/workforce/profiles/${p.id}`}>
          {t('profiles.open')}
          <span className="sr-only"> {p.person.full_name}</span>
        </Link>
      ),
    },
  ];

  const select = (
    key: string,
    label: string,
    any: string,
    options: readonly { id: string; label: string }[],
  ) => (
    <Select
      label={label}
      className="w-full sm:w-40"
      value={table.filters[key] ?? 'any'}
      options={[{ id: 'any', label: any }, ...options]}
      onChange={(value) => {
        table.setFilter(key, value === 'any' ? null : value);
      }}
    />
  );

  const addHref = `/workforce/profiles/new${type ? `?type=${type}` : ''}`;
  const add = canCreate ? (
    <ButtonLink href={addHref} iconStart="plus">
      {t(`profiles.add.${type ?? 'any'}`)}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t(`profiles.title.${type ?? 'any'}`)}
        description={t(`profiles.description.${type ?? 'any'}`)}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {type ? <ImportButton type={`workforce.${type}`} /> : null}
            {add}
          </span>
        }
      />
      <ScopeNotice scope={list.appliedScope} />
      <SummaryCards summary={summary.data} noun={noun} />
      <DataTable
        label={t(`profiles.title.${type ?? 'any'}`)}
        columns={columns}
        getRowId={(p) => p.id}
        getRowLabel={(p) => `${p.person.full_name} (${p.profile_number})`}
        storageKey={`workforce-profiles-${type ?? 'any'}`}
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t(`profiles.itemLabel.${type ?? 'any'}`) }}
        toolbar={
          <>
            <Input
              label={t('profiles.search')}
              placeholder={t('profiles.searchPlaceholder')}
              className="w-full sm:w-48"
              type="search"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            {select(
              ESTATE,
              t('profiles.estateFilter'),
              t('profiles.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {type === undefined
              ? select(
                  TYPE,
                  t('profiles.typeFilter'),
                  t('profiles.anyType'),
                  EMPLOYMENT_TYPES.map((value) => ({ id: value, label: t(`employmentTypes.${value}`) })),
                )
              : null}
            {shownType !== undefined
              ? select(
                  CATEGORY,
                  t('profiles.categoryFilter'),
                  t('profiles.anyCategory'),
                  (categories.data ?? []).map((row) => ({ id: row.id, label: lookupText(row, 'name') })),
                )
              : null}
            {select(
              DEPARTMENT,
              t('profiles.departmentFilter'),
              t('profiles.anyDepartment'),
              (departments.data ?? []).map((row) => ({ id: row.id, label: lookupText(row, 'name') })),
            )}
            {select(
              DESIGNATION,
              t('profiles.designationFilter'),
              t('profiles.anyDesignation'),
              (designations.data ?? []).map((row) => ({ id: row.id, label: lookupText(row, 'name') })),
            )}
            {estateId === ''
              ? null
              : select(
                  SECTION,
                  t('profiles.sectionFilter'),
                  t('profiles.anySection'),
                  sections.sections.map((section) => ({ id: section.id, label: section.name })),
                )}
            {select(
              ENGAGEMENT,
              t('profiles.engagementFilter'),
              t('profiles.anyEngagement'),
              ENGAGEMENT_TYPES.map((value) => ({ id: value, label: t(`engagement.${value}`) })),
            )}
            {select(
              STATUS,
              t('profiles.statusFilter'),
              t('profiles.anyStatus'),
              PROFILE_STATUSES.map((value) => ({ id: value, label: t(`profileStatus.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('profiles.emptyFilteredTitle')}
              description={t('profiles.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('profiles.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t(`profiles.emptyNewTitle.${type ?? 'any'}`)}
              description={t('profiles.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
      {summary.data ? (
        <>
          <Breakdowns summary={summary.data} />
          <Celebrations summary={summary.data} />
        </>
      ) : null}
    </Stack>
  );
}

export function WorkersPage() {
  return <ProfilesPage type="worker" />;
}

export function EmployeesPage() {
  return <ProfilesPage type="employee" />;
}

export function AllProfilesPage() {
  return <ProfilesPage />;
}
