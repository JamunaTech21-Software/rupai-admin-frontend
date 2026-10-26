import { ScopeNotice, useAllEstates } from '@/features/organisation';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey, useUrlTab } from '@/lib/urlState';
import {
  Button,
  ButtonLink,
  type DataColumn,
  DataTable,
  EmptyState,
  Link,
  PageHeader,
  Select,
  Stack,
  StatCard,
  Tabs,
} from '@/ui';

import { GOAL_OWNER_TYPES, GOAL_STATES, type Goal, useGoalOverview, useGoalsList } from '../api/performance';
import { GoalCalendar } from '../components/GoalCalendar';
import { GoalStateBadge } from '../components/GoalActions';

const ESTATE = filterKey('estate_id');
const OWNER = filterKey('owner_type');
const STATE = filterKey('state');

function GoalList() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('goal.create');
  const list = useGoalsList();
  const estates = useAllEstates();
  const { table } = list;
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Goal>[] = [
    {
      id: 'goal_code',
      header: t('goals.columns.code'),
      isSortable: true,
      cell: (g) => (
        <Link href={`/hr/goals/${g.id}`} className="font-mono">
          {g.goal_code}
        </Link>
      ),
    },
    { id: 'title', header: t('goals.columns.title'), cell: (g) => g.title },
    { id: 'owner', header: t('goals.columns.owner'), cell: (g) => g.owner_name ?? none },
    {
      id: 'due',
      header: t('goals.columns.due'),
      isSortable: true,
      cell: (g) => format.date(g.due_date),
    },
    {
      id: 'progress',
      header: t('goals.columns.progress'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (g) => `${format.decimal(g.progress_percentage, 1)}%`,
    },
    {
      id: 'state',
      header: t('goals.columns.state'),
      align: 'center',
      cell: (g) => <GoalStateBadge state={g.state} />,
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
      className="w-full sm:w-44"
      value={table.filters[key] ?? 'any'}
      options={[{ id: 'any', label: any }, ...options]}
      onChange={(value) => {
        table.setFilter(key, value === 'any' ? null : value);
      }}
    />
  );

  const add = canCreate ? (
    <ButtonLink href="/hr/goals/new" iconStart="plus">
      {t('goals.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <>
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('goals.title')}
        columns={columns}
        getRowId={(g) => g.id}
        getRowLabel={(g) => `${g.goal_code} ${g.title}`}
        storageKey="hr-goals"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('goals.itemLabel') }}
        toolbar={
          <>
            {select(
              ESTATE,
              t('benefits.estateFilter'),
              t('benefits.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              OWNER,
              t('goals.ownerType'),
              t('goals.anyOwner'),
              GOAL_OWNER_TYPES.map((value) => ({ id: value, label: t(`goalOwnerTypes.${value}`) })),
            )}
            {select(
              STATE,
              t('benefits.stateFilter'),
              t('benefits.anyState'),
              GOAL_STATES.map((value) => ({ id: value, label: t(`goalStates.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('benefits.emptyFilteredTitle')}
              description={t('benefits.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('benefits.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('goals.emptyTitle')}
              description={t('goals.emptyBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </>
  );
}

/** HR → Goals (P2.10): the figures, then the goals as a list or on a calendar. */
export function GoalsPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('goal.create');
  const tab = useUrlTab('view', 'list');
  const overview = useGoalOverview(null);
  const n = (value: number | undefined) => (value === undefined ? '…' : format.number(value));

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('goals.title')}
        description={t('goals.description')}
        actions={
          canCreate ? (
            <ButtonLink href="/hr/goals/new" iconStart="plus">
              {t('goals.add')}
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t('goals.overview.total')} value={n(overview.data?.total)} />
        <StatCard label={t('goals.overview.completed')} value={n(overview.data?.completed)} />
        <StatCard label={t('goals.overview.inProgress')} value={n(overview.data?.in_progress)} />
        <StatCard label={t('goals.overview.delayed')} value={n(overview.data?.delayed)} />
        <StatCard label={t('goals.overview.overdue')} value={n(overview.data?.overdue)} />
      </div>
      <Tabs
        label={t('goals.viewsLabel')}
        {...tab}
        items={[
          { id: 'list', label: t('goals.listView'), content: <GoalList /> },
          { id: 'calendar', label: t('goals.calendarView'), content: <GoalCalendar estateId={null} /> },
        ]}
      />
    </Stack>
  );
}

export { GoalsPage as Component };
