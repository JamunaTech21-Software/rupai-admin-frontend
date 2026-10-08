import { useTranslation } from '@/lib/i18n';
import { filterKey, type useUrlTableState } from '@/lib/urlState';
import { Button, EmptyState, Input, Select } from '@/ui';

import { STATUSES } from '../api/schemas';

type Table = ReturnType<typeof useUrlTableState>;

/** Name search, a type filter and a status filter: the toolbar of every master-data list. */
export function MasterFilters({
  table,
  typeField,
  typeLabel,
  anyType,
  types,
}: {
  readonly table: Table;
  /** The API field of the type filter: factory_type, warehouse_type, party_type. */
  readonly typeField: string;
  readonly typeLabel: string;
  readonly anyType: string;
  readonly types: readonly { id: string; label: string }[];
}) {
  const { t } = useTranslation('org');
  const search = filterKey('name', 'like');
  const type = filterKey(typeField);
  const status = filterKey('status');
  return (
    <>
      <Input
        label={t('estates.search')}
        placeholder={t('estates.searchPlaceholder')}
        className="w-full sm:w-56"
        value={table.filters[search] ?? ''}
        onChange={(text) => {
          table.setFilter(search, text);
        }}
      />
      <Select
        label={typeLabel}
        className="w-full sm:w-40"
        value={table.filters[type] ?? 'any'}
        options={[{ id: 'any', label: anyType }, ...types]}
        onChange={(value) => {
          table.setFilter(type, value === 'any' ? null : value);
        }}
      />
      <Select
        label={t('estates.statusFilter')}
        className="w-full sm:w-40"
        value={table.filters[status] ?? 'any'}
        options={[
          { id: 'any', label: t('estates.anyStatus') },
          ...STATUSES.map((value) => ({ id: value, label: t(`status.${value}`) })),
        ]}
        onChange={(value) => {
          table.setFilter(status, value === 'any' ? null : value);
        }}
      />
    </>
  );
}

/** "No … match" with Clear filters, or the first-use empty state with the add action. */
export function MasterEmpty({
  table,
  filteredTitle,
  filteredBody,
  newTitle,
  newBody,
  add,
}: {
  readonly table: Table;
  readonly filteredTitle: string;
  readonly filteredBody: string;
  readonly newTitle: string;
  readonly newBody: string;
  readonly add: React.ReactNode;
}) {
  const { t } = useTranslation('org');
  return table.hasFilters ? (
    <EmptyState
      kind="no-results"
      title={filteredTitle}
      description={filteredBody}
      action={
        <Button variant="secondary" onPress={table.clearFilters}>
          {t('estates.clearFilters')}
        </Button>
      }
    />
  ) : (
    <EmptyState kind="new" title={newTitle} description={newBody} {...(add ? { action: add } : {})} />
  );
}
