import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import { Button, type DataColumn, DataTable, EmptyState, Link, PageHeader, Select, Stack } from '@/ui';

import { useFiscalYearsList } from '../api/calendar';
import { FISCAL_YEAR_STATES, type FiscalYear } from '../api/schemas';
import { FiscalYearStateBadge } from '../components/CalendarBadges';

const FiscalYearCreateModal = lazy(() =>
  import('../components/FiscalYearCreateModal').then((m) => ({ default: m.FiscalYearCreateModal })),
);

const STATE = filterKey('state');

/** The year after the latest fiscal year on this page, or this calendar year when there is none. */
function nextStartYear(rows: readonly FiscalYear[]): number {
  const latest = rows
    .map((year) => year.start_date.slice(0, 4))
    .sort()
    .at(-1);
  return latest ? Number.parseInt(latest, 10) + 1 : new Date().getFullYear();
}

/** Calendars → Fiscal years (P1.09): one calendar for the whole organisation, latest first. */
export function FiscalYearsPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const navigate = useNavigate();
  const canCreate = usePermission('fiscal_year.create');
  const list = useFiscalYearsList();
  const { table } = list;
  const [isAdding, setIsAdding] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  const columns: DataColumn<FiscalYear>[] = [
    {
      id: 'code',
      header: t('fiscalYears.columns.code'),
      isSortable: true,
      cell: (year) => <span className="font-mono text-sm">{year.code}</span>,
    },
    {
      id: 'name',
      header: t('fiscalYears.columns.name'),
      cell: (year) => <Link href={`/fiscal-years/${year.id}`}>{year.name}</Link>,
    },
    {
      id: 'start_date',
      header: t('fiscalYears.columns.start'),
      isSortable: true,
      align: 'center',
      cell: (year) => <span className="whitespace-nowrap">{format.date(year.start_date)}</span>,
    },
    {
      id: 'end_date',
      header: t('fiscalYears.columns.end'),
      align: 'center',
      cell: (year) => <span className="whitespace-nowrap">{format.date(year.end_date)}</span>,
    },
    {
      id: 'period_count',
      header: t('fiscalYears.columns.periods'),
      isNumeric: true,
      align: 'center',
      cell: (year) =>
        year.period_count > 0 ? (
          format.number(year.period_count)
        ) : (
          <span className="text-fg-subtle">{t('fiscalYears.notGenerated')}</span>
        ),
    },
    {
      id: 'state',
      header: t('fiscalYears.columns.state'),
      align: 'center',
      cell: (year) => <FiscalYearStateBadge state={year.state} />,
    },
  ];

  const add = canCreate ? (
    <Button
      iconStart="plus"
      onPress={() => {
        setIsAdding(true);
      }}
    >
      {t('fiscalYears.add')}
    </Button>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('fiscalYears.title')} description={t('fiscalYears.description')} actions={add} />
      <DataTable
        label={t('fiscalYears.title')}
        columns={columns}
        getRowId={(year) => year.id}
        getRowLabel={(year) => year.name}
        storageKey="cal-fiscal-years"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('fiscalYears.itemLabel') }}
        toolbar={
          <Select
            label={t('fiscalYears.stateFilter')}
            className="w-full sm:w-40"
            value={table.filters[STATE] ?? 'any'}
            options={[
              { id: 'any', label: t('fiscalYears.anyState') },
              ...FISCAL_YEAR_STATES.map((state) => ({ id: state, label: t(`fiscalYearState.${state}`) })),
            ]}
            onChange={(value) => {
              table.setFilter(STATE, value === 'any' ? null : value);
            }}
          />
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('fiscalYears.emptyFilteredTitle')}
              description={t('fiscalYears.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('periods.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('fiscalYears.emptyNewTitle')}
              description={t('fiscalYears.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
      {isAdding ? (
        <Suspense fallback={null}>
          <FiscalYearCreateModal
            suggestedYear={nextStartYear(list.rows)}
            onClose={() => {
              setIsAdding(false);
            }}
            onCreated={(year) => {
              // Straight to the new year: its computed dates, and "Generate periods".
              void navigate(`/fiscal-years/${year.id}`);
            }}
            onRefused={(error) => {
              setIsAdding(false);
              setRefusal(error);
            }}
          />
        </Suspense>
      ) : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { FiscalYearsPage as Component };
