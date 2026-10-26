import { ScopeNotice, useAllEstates } from '@/features/organisation';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { lookupText, useActiveLookups } from '@/lib/lookups';
import { filterKey } from '@/lib/urlState';
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
} from '@/ui';

import { LEAVE_STATES, type Leave, useLeaveList } from '../api/leave';
import { LeaveStateBadge } from '../components/LeaveActions';

const STATE = filterKey('state');
const ESTATE = filterKey('estate_id');
const TYPE = filterKey('leave_type_id');

/**
 * HR → Leave (P2.07): the leave register: every request the user may see, newest first (a worker sees their own), with
 * the way to ask for leave and to look at the balances.
 */
export function LeavePage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('leave.create');
  const canRead = usePermission('lookup.view');
  const list = useLeaveList();
  const estates = useAllEstates();
  const types = useActiveLookups('leave_type', canRead);
  const { table } = list;
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Leave>[] = [
    {
      id: 'request_number',
      header: t('leave.columns.number'),
      isSortable: true,
      cell: (l) => (
        <Link href={`/hr/leave/${l.id}`} className="font-mono">
          {l.request_number}
        </Link>
      ),
    },
    {
      id: 'employee',
      header: t('leave.columns.employee'),
      cell: (l) => (
        <span className="flex flex-col">
          <span className="font-medium">{l.profile.full_name}</span>
          <span className="font-mono text-sm text-fg-muted">{l.profile.profile_number}</span>
        </span>
      ),
    },
    { id: 'type', header: t('leave.columns.type'), cell: (l) => l.leave_type.name },
    {
      id: 'period',
      header: t('leave.columns.period'),
      cell: (l) =>
        l.from_date === l.to_date
          ? format.date(l.from_date)
          : `${format.date(l.from_date)} – ${format.date(l.to_date)}`,
    },
    {
      id: 'days',
      header: t('leave.columns.days'),
      isNumeric: true,
      align: 'center',
      cell: (l) => format.decimal(l.day_count, 1),
    },
    { id: 'reason', header: t('leave.columns.reason'), canHide: true, cell: (l) => l.reason ?? none },
    {
      id: 'covering',
      header: t('leave.columns.covering'),
      canHide: true,
      isHiddenByDefault: true,
      cell: (l) => l.covering?.full_name ?? none,
    },
    {
      id: 'state',
      header: t('leave.columns.state'),
      align: 'center',
      cell: (l) => <LeaveStateBadge state={l.state} />,
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
    <ButtonLink href="/hr/leave/new" iconStart="plus">
      {t('leave.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('leave.title')}
        description={t('leave.description')}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/hr/leave/balances" variant="secondary">
              {t('leave.balances')}
            </ButtonLink>
            {add}
          </span>
        }
      />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('leave.title')}
        columns={columns}
        getRowId={(l) => l.id}
        getRowLabel={(l) => `${l.profile.full_name} (${l.request_number})`}
        storageKey="hr-leave"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('leave.itemLabel') }}
        toolbar={
          <>
            {select(
              ESTATE,
              t('leave.estateFilter'),
              t('leave.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              TYPE,
              t('leave.typeFilter'),
              t('leave.anyType'),
              (types.data ?? []).map((row) => ({ id: row.id, label: lookupText(row, 'name') })),
            )}
            {select(
              STATE,
              t('leave.stateFilter'),
              t('leave.anyState'),
              LEAVE_STATES.map((value) => ({ id: value, label: t(`leaveStates.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('leave.emptyFilteredTitle')}
              description={t('leave.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('leave.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('leave.emptyNewTitle')}
              description={t('leave.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { LeavePage as Component };
