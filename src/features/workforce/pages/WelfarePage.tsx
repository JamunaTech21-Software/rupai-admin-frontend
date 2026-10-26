import { ScopeNotice, useAllEstates } from '@/features/organisation';
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

import { CASE_STATES, useCasesList, WELFARE_CATEGORIES, type WelfareCase } from '../api/benefits';
import { CaseStateBadge } from '../components/WelfareActions';

const ESTATE = filterKey('estate_id');
const CATEGORY = filterKey('welfare_category');
const STATE = filterKey('state');

/**
 * HR → Welfare (P2.08): the welfare cases of the estates the user may see: who it is for, the kind of help, what was
 * asked, what was approved and paid, and where each stands.
 */
export function WelfarePage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('welfare.create');
  const list = useCasesList();
  const estates = useAllEstates();
  const { table } = list;
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<WelfareCase>[] = [
    {
      id: 'case_number',
      header: t('welfare.columns.number'),
      cell: (c) => (
        <Link href={`/hr/welfare/${c.id}`} className="font-mono">
          {c.case_number}
        </Link>
      ),
    },
    {
      id: 'beneficiary',
      header: t('welfare.columns.beneficiary'),
      cell: (c) =>
        c.beneficiary_type === 'community' ? t('beneficiaryTypes.community') : (c.beneficiary_name ?? none),
    },
    {
      id: 'category',
      header: t('welfare.columns.category'),
      cell: (c) => t(`welfareCategories.${c.welfare_category}`),
    },
    {
      id: 'date',
      header: t('welfare.columns.date'),
      isSortable: true,
      cell: (c) => format.date(c.case_date),
    },
    {
      id: 'requested',
      header: t('welfare.columns.requested'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (c) => (c.requested_amount ? format.money(c.requested_amount) : none),
    },
    {
      id: 'approved',
      header: t('welfare.columns.approved'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (c) => (c.approved_amount ? format.money(c.approved_amount) : none),
    },
    {
      id: 'paid',
      header: t('welfare.columns.paid'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (c) => format.money(c.disbursed_amount),
    },
    {
      id: 'state',
      header: t('welfare.columns.state'),
      align: 'center',
      cell: (c) => <CaseStateBadge state={c.state} />,
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
    <ButtonLink href="/hr/welfare/new" iconStart="plus">
      {t('welfare.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('welfare.title')} description={t('welfare.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('welfare.title')}
        columns={columns}
        getRowId={(c) => c.id}
        getRowLabel={(c) => c.case_number}
        storageKey="hr-welfare"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('welfare.itemLabel') }}
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
              CATEGORY,
              t('welfare.categoryFilter'),
              t('welfare.anyCategory'),
              WELFARE_CATEGORIES.map((value) => ({ id: value, label: t(`welfareCategories.${value}`) })),
            )}
            {select(
              STATE,
              t('benefits.stateFilter'),
              t('benefits.anyState'),
              CASE_STATES.map((value) => ({ id: value, label: t(`caseStates.${value}`) })),
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
              title={t('welfare.emptyTitle')}
              description={t('welfare.emptyBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { WelfarePage as Component };
