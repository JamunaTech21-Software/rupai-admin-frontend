import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { ButtonLink, type DataColumn, DataTable, Link, PageHeader, Stack } from '@/ui';

import { usePartiesList } from '../api/facilities';
import { type Party, PARTY_TYPES } from '../api/schemas';
import { MasterEmpty, MasterFilters } from '../components/MasterFilters';
import { NodeStatusBadge } from '../components/NodeLifecycle';

/** Organisation → Parties (P1.08): landowners, lessors and other parties to land agreements (land.*). */
export function PartiesPage() {
  const { t } = useTranslation('org');
  const canCreate = usePermission('land.create');
  const list = usePartiesList();

  const columns: DataColumn<Party>[] = [
    {
      id: 'code',
      header: t('parties.columns.code'),
      isSortable: true,
      cell: (row) => <span className="font-mono text-sm">{row.code}</span>,
    },
    {
      id: 'name',
      header: t('parties.columns.name'),
      isSortable: true,
      cell: (row) => <Link href={`/parties/${row.id}`}>{row.name}</Link>,
    },
    { id: 'party_type', header: t('parties.columns.type'), cell: (row) => t(`partyType.${row.party_type}`) },
    {
      id: 'district',
      header: t('parties.columns.district'),
      canHide: true,
      cell: (row) => row.district ?? '',
    },
    { id: 'phone', header: t('parties.columns.phone'), canHide: true, cell: (row) => row.phone ?? '' },
    {
      id: 'status',
      header: t('parties.columns.status'),
      cell: (row) => <NodeStatusBadge status={row.status} />,
    },
  ];

  const add = canCreate ? (
    <ButtonLink href="/parties/new" iconStart="plus">
      {t('parties.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('parties.title')} description={t('parties.description')} actions={add} />
      <DataTable
        label={t('parties.title')}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        storageKey="org-parties"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('parties.itemLabel') }}
        toolbar={
          <MasterFilters
            table={list.table}
            typeField="party_type"
            typeLabel={t('parties.typeFilter')}
            anyType={t('parties.anyType')}
            types={PARTY_TYPES.map((type) => ({ id: type, label: t(`partyType.${type}`) }))}
          />
        }
        emptyState={
          <MasterEmpty
            table={list.table}
            filteredTitle={t('parties.emptyFilteredTitle')}
            filteredBody={t('parties.emptyFilteredBody')}
            newTitle={t('parties.emptyNewTitle')}
            newBody={t('parties.emptyNewBody')}
            add={add}
          />
        }
      />
    </Stack>
  );
}

export { PartiesPage as Component };
