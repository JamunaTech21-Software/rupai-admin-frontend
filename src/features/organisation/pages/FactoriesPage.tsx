import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { ButtonLink, type DataColumn, DataTable, Link, PageHeader, Stack } from '@/ui';

import { useFactoriesList } from '../api/facilities';
import { type Factory, FACTORY_TYPES } from '../api/schemas';
import { LicenceExpiry } from '../components/LicenceExpiry';
import { MasterEmpty, MasterFilters } from '../components/MasterFilters';
import { NodeStatusBadge } from '../components/NodeLifecycle';

/** Organisation → Factories (P1.08). */
export function FactoriesPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canCreate = usePermission('factory.create');
  const list = useFactoriesList();

  const columns: DataColumn<Factory>[] = [
    {
      id: 'code',
      header: t('factories.columns.code'),
      isSortable: true,
      cell: (row) => <span className="font-mono text-sm">{row.code}</span>,
    },
    {
      id: 'name',
      header: t('factories.columns.name'),
      isSortable: true,
      cell: (row) => <Link href={`/factories/${row.id}`}>{row.name}</Link>,
    },
    {
      id: 'factory_type',
      header: t('factories.columns.type'),
      cell: (row) => t(`factoryType.${row.factory_type}`),
    },
    {
      id: 'daily_capacity_kg',
      header: t('factories.columns.capacity'),
      isNumeric: true,
      canHide: true,
      cell: (row) => (row.daily_capacity_kg ? format.quantity(row.daily_capacity_kg) : ''),
    },
    {
      id: 'licence_expiry',
      header: t('factories.columns.licence'),
      canHide: true,
      cell: (row) => <LicenceExpiry expiry={row.licence_expiry} />,
    },
    {
      id: 'status',
      header: t('factories.columns.status'),
      cell: (row) => <NodeStatusBadge status={row.status} />,
    },
  ];

  const add = canCreate ? (
    <ButtonLink href="/factories/new" iconStart="plus">
      {t('factories.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('factories.title')} description={t('factories.description')} actions={add} />
      <DataTable
        label={t('factories.title')}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        storageKey="org-factories"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('factories.itemLabel') }}
        toolbar={
          <MasterFilters
            table={list.table}
            typeField="factory_type"
            typeLabel={t('factories.typeFilter')}
            anyType={t('factories.anyType')}
            types={FACTORY_TYPES.map((type) => ({ id: type, label: t(`factoryType.${type}`) }))}
          />
        }
        emptyState={
          <MasterEmpty
            table={list.table}
            filteredTitle={t('factories.emptyFilteredTitle')}
            filteredBody={t('factories.emptyFilteredBody')}
            newTitle={t('factories.emptyNewTitle')}
            newBody={t('factories.emptyNewBody')}
            add={add}
          />
        }
      />
    </Stack>
  );
}

export { FactoriesPage as Component };
