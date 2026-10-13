import { useState } from 'react';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
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

import { useAllFiscalYears, useNextPeriodsToOpen, usePeriodsList } from '../api/calendar';
import { type AccountingPeriod, PERIOD_STATES } from '../api/schemas';
import { PeriodStateBadge } from '../components/CalendarBadges';
import { OpenPeriodButton } from '../components/OpenPeriodButton';

const YEAR = filterKey('fiscal_year_id');
const STATE = filterKey('state');

/** Calendars → Accounting periods (P1.09): every period, in date order; periods are opened in order. */
export function PeriodsPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canOpen = usePermission('accounting_period.edit');
  const canViewYears = usePermission('fiscal_year.view');
  const list = usePeriodsList();
  const years = useAllFiscalYears(canViewYears);
  const nextToOpen = useNextPeriodsToOpen(canOpen);
  const { table } = list;
  const [refusal, setRefusal] = useState<unknown>(null);

  const columns: DataColumn<AccountingPeriod>[] = [
    {
      id: 'fiscal_year',
      header: t('periods.columns.year'),
      cell: (period) => {
        const year = years.data?.find((y) => y.id === period.fiscal_year_id);
        if (!year) return years.isPending && canViewYears ? '…' : `#${period.fiscal_year_id}`;
        return (
          <Link href={`/fiscal-years/${year.id}`} className="font-mono text-sm">
            {year.code}
          </Link>
        );
      },
    },
    {
      id: 'period_number',
      header: t('periods.columns.number'),
      isNumeric: true,
      align: 'center',
      cell: (period) => format.number(period.period_number),
    },
    {
      id: 'name',
      header: t('periods.columns.name'),
      cell: (period) => period.name,
    },
    {
      id: 'start_date',
      header: t('periods.columns.start'),
      isSortable: true,
      align: 'center',
      cell: (period) => <span className="whitespace-nowrap">{format.date(period.start_date)}</span>,
    },
    {
      id: 'end_date',
      header: t('periods.columns.end'),
      align: 'center',
      canHide: true,
      cell: (period) => <span className="whitespace-nowrap">{format.date(period.end_date)}</span>,
    },
    {
      id: 'state',
      header: t('periods.columns.state'),
      align: 'center',
      cell: (period) => <PeriodStateBadge state={period.state} />,
    },
    ...(canOpen
      ? [
          {
            id: 'action',
            header: t('periods.columns.action'),
            align: 'center',
            cell: (period) =>
              nextToOpen.data?.get(period.fiscal_year_id) === period.id ? (
                <OpenPeriodButton period={period} onRefused={setRefusal} />
              ) : null,
          } satisfies DataColumn<AccountingPeriod>,
        ]
      : []),
  ];

  return (
    <Stack gap={6}>
      <PageHeader title={t('periods.title')} description={t('periods.description')} />
      <DataTable
        label={t('periods.title')}
        columns={columns}
        getRowId={(period) => period.id}
        getRowLabel={(period) => period.name}
        storageKey="cal-periods"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('periods.itemLabel') }}
        toolbar={
          <>
            {canViewYears ? (
              <Select
                label={t('periods.yearFilter')}
                className="w-full sm:w-64"
                value={table.filters[YEAR] ?? 'any'}
                options={[
                  { id: 'any', label: t('periods.anyYear') },
                  ...(years.data ?? []).map((y) => ({ id: y.id, label: `${y.code} · ${y.name}` })),
                ]}
                onChange={(value) => {
                  table.setFilter(YEAR, value === 'any' ? null : value);
                }}
              />
            ) : null}
            <Select
              label={t('periods.stateFilter')}
              className="w-full sm:w-40"
              value={table.filters[STATE] ?? 'any'}
              options={[
                { id: 'any', label: t('periods.anyState') },
                ...PERIOD_STATES.map((state) => ({ id: state, label: t(`periodState.${state}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATE, value === 'any' ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('periods.emptyFilteredTitle')}
              description={t('periods.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('periods.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('periods.emptyNewTitle')}
              description={t('periods.emptyNewBody')}
              {...(canViewYears
                ? {
                    action: (
                      <ButtonLink href="/fiscal-years" variant="secondary">
                        {t('fiscalYears.title')}
                      </ButtonLink>
                    ),
                  }
                : {})}
            />
          )
        }
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { PeriodsPage as Component };
