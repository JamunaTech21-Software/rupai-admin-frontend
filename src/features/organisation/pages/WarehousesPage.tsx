import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { ButtonLink, type DataColumn, DataTable, Link, PageHeader, Stack } from '@/ui';

import { useWarehousesList } from '../api/facilities';
import { type Warehouse, WAREHOUSE_TYPES } from '../api/schemas';
import { LicenceExpiry } from '../components/LicenceExpiry';
import { MasterEmpty, MasterFilters } from '../components/MasterFilters';
import { NodeStatusBadge } from '../components/NodeLifecycle';

/** Organisation → Warehouses (P1.08). */
export function WarehousesPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canCreate = usePermission('warehouse.create');
  const list = useWarehousesList();

  const columns: DataColumn<Warehouse>[] = [
    {
      id: 'code',
      header: t('warehouses.columns.code'),
      isSortable: true,
      cell: (row) => <span className="font-mono text-sm">{row.code}</span>,
    },
    {
      id: 'name',
      header: t('warehouses.columns.name'),
      isSortable: true,
      cell: (row) => <Link href={`/warehouses/${row.id}`}>{row.name}</Link>,
    },
    {
      id: 'warehouse_type',
      header: t('warehouses.columns.type'),
      cell: (row) => t(`warehouseType.${row.warehouse_type}`),
    },
    {
      id: 'location',
      header: t('warehouses.columns.location'),
      canHide: true,
      cell: (row) => row.location ?? '',
    },
    {
      id: 'capacity_kg',
      header: t('warehouses.columns.capacity'),
      isNumeric: true,
      canHide: true,
      cell: (row) => (row.capacity_kg ? format.quantity(row.capacity_kg) : ''),
    },
    { id: 'phone', header: t('warehouses.columns.phone'), canHide: true, cell: (row) => row.phone ?? '' },
    {
      id: 'licence_expiry',
      header: t('warehouses.columns.licence'),
      canHide: true,
      cell: (row) => <LicenceExpiry expiry={row.licence_expiry} />,
    },
    {
      id: 'status',
      header: t('warehouses.columns.status'),
      cell: (row) => <NodeStatusBadge status={row.status} />,
    },
  ];

  const add = canCreate ? (
    <ButtonLink href="/warehouses/new" iconStart="plus">
      {t('warehouses.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('warehouses.title')} description={t('warehouses.description')} actions={add} />
      <DataTable
        label={t('warehouses.title')}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        storageKey="org-warehouses"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('warehouses.itemLabel') }}
        toolbar={
          <MasterFilters
            table={list.table}
            typeField="warehouse_type"
            typeLabel={t('warehouses.typeFilter')}
            anyType={t('warehouses.anyType')}
            types={WAREHOUSE_TYPES.map((type) => ({ id: type, label: t(`warehouseType.${type}`) }))}
          />
        }
        emptyState={
          <MasterEmpty
            table={list.table}
            filteredTitle={t('warehouses.emptyFilteredTitle')}
            filteredBody={t('warehouses.emptyFilteredBody')}
            newTitle={t('warehouses.emptyNewTitle')}
            newBody={t('warehouses.emptyNewBody')}
            add={add}
          />
        }
      />
    </Stack>
  );
}

export { WarehousesPage as Component };
