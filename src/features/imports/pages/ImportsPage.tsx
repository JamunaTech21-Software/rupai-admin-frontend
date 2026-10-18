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

import { type Batch, BATCH_STATES, useImportsList, useImportTypes } from '../api/imports';
import { BatchStateBadge } from '../components/BatchStateBadge';

const ANY = 'any';
const TYPE = filterKey('import_type');
const STATE = filterKey('state');

/**
 * Imports (P1.17): the files imported so far, newest first: your own, and every batch of the kinds you may view. A
 * batch opens on its own page, where an unfinished one can be continued. "New import" starts the wizard.
 */
export function ImportsPage() {
  const { t } = useTranslation('imports');
  const format = useFormat();
  const list = useImportsList();
  const types = useImportTypes();
  const { table } = list;
  const label = (key: string) => types.data?.find((candidate) => candidate.key === key)?.label ?? key;

  const columns: DataColumn<Batch>[] = [
    {
      id: 'import',
      header: t('history.import'),
      cell: (batch) => (
        <span className="flex flex-col">
          <Link href={`/imports/${batch.id}`}>{batch.label}</Link>
          <span className="text-sm text-fg-muted">{batch.file_name}</span>
        </span>
      ),
    },
    { id: 'state', header: t('history.state'), cell: (batch) => <BatchStateBadge state={batch.state} /> },
    {
      id: 'rows',
      header: t('history.rows'),
      isNumeric: true,
      canHide: true,
      cell: (batch) => format.number(batch.row_count),
    },
    {
      id: 'committed',
      header: t('history.committed'),
      isNumeric: true,
      canHide: true,
      cell: (batch) => format.number(batch.committed_count),
    },
    {
      id: 'errors',
      header: t('history.errors'),
      isNumeric: true,
      canHide: true,
      cell: (batch) => format.number(batch.error_count + batch.failed_count),
    },
    { id: 'by', header: t('history.by'), canHide: true, cell: (batch) => batch.created_by.username },
    { id: 'when', header: t('history.when'), cell: (batch) => format.dateTime(batch.created_at) },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <ButtonLink href="/imports/new" iconStart="upload">
            {t('new.title')}
          </ButtonLink>
        }
      />
      <DataTable
        label={t('title')}
        columns={columns}
        getRowId={(batch) => batch.id}
        getRowLabel={(batch) => batch.label}
        storageKey="imports"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('itemLabel') }}
        toolbar={
          <>
            <Select
              label={t('history.filterType')}
              className="w-full sm:w-64"
              value={table.filters[TYPE] ?? ANY}
              options={[
                { id: ANY, label: t('history.anyType') },
                ...(types.data ?? []).map((type) => ({ id: type.key, label: label(type.key) })),
              ]}
              onChange={(value) => {
                table.setFilter(TYPE, value === null || value === ANY ? null : value);
              }}
            />
            <Select
              label={t('history.filterState')}
              className="w-full sm:w-48"
              value={table.filters[STATE] ?? ANY}
              options={[
                { id: ANY, label: t('history.anyState') },
                ...BATCH_STATES.map((state) => ({ id: state, label: t(`states.${state}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATE, value === null || value === ANY ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('history.emptyFilteredTitle')}
              description={t('history.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('history.emptyTitle')} description={t('history.emptyBody')} />
          )
        }
      />
    </Stack>
  );
}

export { ImportsPage as Component };
