import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
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

import { useAllEstates, useFieldsList } from '../api/hierarchy';
import { type Field, FIELD_STATUSES, STATUSES } from '../api/schemas';
import { NodeStatusBadge } from '../components/NodeLifecycle';
import { ScopeNotice } from '../components/ScopeNotice';

const SEARCH = filterKey('field_number', 'like');
const ESTATE = filterKey('estate_id');
const FIELD_STATUS = filterKey('field_status');
const STATUS = filterKey('status');

/** Organisation → Fields (P1.07): every field the user may see, by estate and status. */
export function FieldsPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canCreate = usePermission('field.create');
  const list = useFieldsList();
  const estates = useAllEstates();
  const { table } = list;
  const estateName = (id: string) => estates.data?.find((estate) => estate.id === id)?.code ?? `#${id}`;

  const columns: DataColumn<Field>[] = [
    {
      id: 'field_number',
      header: t('fields.columns.fieldNumber'),
      isSortable: true,
      cell: (field) => (
        <Link href={`/fields/${field.id}`} className="font-mono">
          {field.field_number}
        </Link>
      ),
    },
    { id: 'name', header: t('fields.columns.name'), canHide: true, cell: (field) => field.name ?? '' },
    { id: 'estate', header: t('fields.columns.estate'), cell: (field) => estateName(field.estate_id) },
    {
      id: 'gross_area',
      header: t('fields.columns.gross'),
      isNumeric: true,
      isSortable: true,
      cell: (field) => format.quantity(field.gross_area, 'ha'),
    },
    {
      id: 'planted_area',
      header: t('fields.columns.planted'),
      isNumeric: true,
      canHide: true,
      cell: (field) => (field.planted_area ? format.quantity(field.planted_area, 'ha') : ''),
    },
    {
      id: 'field_status',
      header: t('fields.columns.fieldStatus'),
      cell: (field) => (
        <Badge
          tone={field.field_status === 'producing' ? 'success' : 'neutral'}
          label={t(`fieldStatus.${field.field_status}`)}
        />
      ),
    },
    {
      id: 'status',
      header: t('fields.columns.status'),
      cell: (field) => <NodeStatusBadge status={field.status} />,
    },
  ];

  const add = canCreate ? (
    <ButtonLink href="/fields/new" iconStart="plus">
      {t('fields.add')}
    </ButtonLink>
  ) : undefined;

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

  return (
    <Stack gap={6}>
      <PageHeader title={t('fields.title')} description={t('fields.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('fields.title')}
        columns={columns}
        getRowId={(field) => field.id}
        getRowLabel={(field) => field.field_number}
        storageKey="org-fields"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('fields.itemLabel') }}
        toolbar={
          <>
            <Input
              label={t('fields.search')}
              placeholder={t('fields.searchPlaceholder')}
              className="w-full sm:w-40"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            {select(
              ESTATE,
              t('fields.estateFilter'),
              t('fields.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              FIELD_STATUS,
              t('fields.fieldStatusFilter'),
              t('fields.anyFieldStatus'),
              FIELD_STATUSES.map((status) => ({ id: status, label: t(`fieldStatus.${status}`) })),
            )}
            {select(
              STATUS,
              t('fields.statusFilter'),
              t('fields.anyStatus'),
              STATUSES.map((status) => ({ id: status, label: t(`status.${status}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('fields.emptyFilteredTitle')}
              description={t('fields.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('fields.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('fields.emptyNewTitle')}
              description={t('fields.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { FieldsPage as Component };
