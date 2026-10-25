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
  Input,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import {
  CONTRACTOR_STATUSES,
  CONTRACTOR_TYPES,
  type Contractor,
  useContractorsList,
  useContractorSummary,
} from '../api/contractors';
import { ContractorStatusBadge } from '../components/ContractorActions';
import { ContractorBreakdowns, ContractorCards } from '../components/ContractorOverview';

const SEARCH = filterKey('q');
const ESTATE = filterKey('estate_id');
const TYPE = filterKey('contractor_type');
const TRADE = filterKey('trade_category_id');
const STATUS = filterKey('status');

/**
 * Workforce → Contractors (P2.05): the manager's Contractor Management: the cards and charts for the garden chosen
 * (or all), and the list with its filters. A contractor's page holds the rest.
 */
export function ContractorsPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('contractor.create');
  const canRead = usePermission('lookup.view');
  const list = useContractorsList();
  const estates = useAllEstates();
  const trades = useActiveLookups('trade_category', canRead);
  const { table } = list;
  const summary = useContractorSummary(table.filters[ESTATE]);
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Contractor>[] = [
    {
      id: 'code',
      header: t('contractors.columns.code'),
      isSortable: true,
      cell: (c) => (
        <Link href={`/workforce/contractors/${c.id}`} className="font-mono">
          {c.code}
        </Link>
      ),
    },
    {
      id: 'name',
      header: t('contractors.columns.name'),
      isSortable: true,
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      id: 'type',
      header: t('contractors.columns.type'),
      canHide: true,
      cell: (c) => t(`contractorTypes.${c.contractor_type}`),
    },
    {
      id: 'trade',
      header: t('contractors.columns.trade'),
      canHide: true,
      cell: (c) => c.trade_category?.name ?? none,
    },
    { id: 'phone', header: t('contractors.columns.phone'), canHide: true, cell: (c) => c.phone ?? none },
    {
      id: 'location',
      header: t('contractors.columns.location'),
      canHide: true,
      cell: (c) => {
        const k = c.current_contract;
        if (!k) return none;
        return k.division?.name ?? (k.work_location ? t(`workLocations.${k.work_location}`) : none);
      },
    },
    {
      id: 'workers',
      header: t('contractors.columns.workers'),
      isNumeric: true,
      align: 'center',
      canHide: true,
      cell: (c) => format.number(c.number_of_workers),
    },
    {
      id: 'period',
      header: t('contractors.columns.period'),
      canHide: true,
      cell: (c) =>
        c.current_contract
          ? `${format.date(c.current_contract.start_date)} – ${format.date(c.current_contract.end_date)}`
          : none,
    },
    {
      id: 'value',
      header: t('contractors.columns.value'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (c) =>
        c.current_contract?.contract_value ? format.money(c.current_contract.contract_value) : none,
    },
    {
      id: 'status',
      header: t('contractors.columns.status'),
      align: 'center',
      cell: (c) => <ContractorStatusBadge status={c.status} />,
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

  const add = canCreate ? (
    <ButtonLink href="/workforce/contractors/new" iconStart="plus">
      {t('contractors.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('contractors.title')} description={t('contractors.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <ContractorCards summary={summary.data} />
      <DataTable
        label={t('contractors.title')}
        columns={columns}
        getRowId={(c) => c.id}
        getRowLabel={(c) => `${c.name} (${c.code})`}
        storageKey="workforce-contractors"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('contractors.itemLabel') }}
        toolbar={
          <>
            <Input
              label={t('contractors.search')}
              placeholder={t('contractors.searchPlaceholder')}
              className="w-full sm:w-48"
              type="search"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            {select(
              ESTATE,
              t('contractors.estateFilter'),
              t('contractors.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              TYPE,
              t('contractors.typeFilter'),
              t('contractors.anyType'),
              CONTRACTOR_TYPES.map((value) => ({ id: value, label: t(`contractorTypes.${value}`) })),
            )}
            {select(
              TRADE,
              t('contractors.tradeFilter'),
              t('contractors.anyTrade'),
              (trades.data ?? []).map((row) => ({ id: row.id, label: lookupText(row, 'name') })),
            )}
            {select(
              STATUS,
              t('contractors.statusFilter'),
              t('contractors.anyStatus'),
              CONTRACTOR_STATUSES.map((value) => ({ id: value, label: t(`contractorStatus.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('contractors.emptyFilteredTitle')}
              description={t('contractors.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('contractors.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('contractors.emptyNewTitle')}
              description={t('contractors.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
      {summary.data ? <ContractorBreakdowns summary={summary.data} /> : null}
    </Stack>
  );
}

export { ContractorsPage as Component };
