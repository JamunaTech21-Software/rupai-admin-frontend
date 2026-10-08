import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
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

import { useEstatesList } from '../api/hierarchy';
import { type Estate, STATUSES } from '../api/schemas';
import { NodeStatusBadge } from '../components/NodeLifecycle';
import { ScopeNotice } from '../components/ScopeNotice';

const SEARCH = filterKey('name', 'like');
const STATUS = filterKey('status');

/** Organisation → Estates (P1.07): every estate the user may see, filtered by name and status. */
export function EstatesPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canCreate = usePermission('estate.create');
  const list = useEstatesList();
  const { table } = list;

  const columns: DataColumn<Estate>[] = [
    {
      id: 'code',
      header: t('estates.columns.code'),
      isSortable: true,
      cell: (estate) => <span className="font-mono text-sm">{estate.code}</span>,
    },
    {
      id: 'name',
      header: t('estates.columns.name'),
      isSortable: true,
      cell: (estate) => <Link href={`/estates/${estate.id}`}>{estate.name}</Link>,
    },
    {
      id: 'district',
      header: t('estates.columns.district'),
      canHide: true,
      cell: (estate) => estate.district ?? '',
    },
    {
      id: 'total_area',
      header: t('estates.columns.area'),
      isNumeric: true,
      cell: (estate) => (estate.total_area ? format.quantity(estate.total_area, 'ha') : ''),
    },
    {
      id: 'ownership_type',
      header: t('estates.columns.ownership'),
      canHide: true,
      cell: (estate) => (estate.ownership_type ? t(`ownership.${estate.ownership_type}`) : ''),
    },
    {
      id: 'status',
      header: t('estates.columns.status'),
      cell: (estate) => <NodeStatusBadge status={estate.status} />,
    },
  ];

  const add = canCreate ? (
    <ButtonLink href="/estates/new" iconStart="plus">
      {t('estates.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('estates.title')} description={t('estates.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('estates.title')}
        columns={columns}
        getRowId={(estate) => estate.id}
        getRowLabel={(estate) => estate.name}
        storageKey="org-estates"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('estates.itemLabel') }}
        toolbar={
          <>
            <Input
              label={t('estates.search')}
              placeholder={t('estates.searchPlaceholder')}
              className="w-full sm:w-56"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            <Select
              label={t('estates.statusFilter')}
              className="w-full sm:w-40"
              value={table.filters[STATUS] ?? 'any'}
              options={[
                { id: 'any', label: t('estates.anyStatus') },
                ...STATUSES.map((status) => ({ id: status, label: t(`status.${status}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATUS, value === 'any' ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('estates.emptyFilteredTitle')}
              description={t('estates.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('estates.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('estates.emptyNewTitle')}
              description={t('estates.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { EstatesPage as Component };
