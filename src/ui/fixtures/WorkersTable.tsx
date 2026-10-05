import { filterKey, useUrlTableState } from '@/lib/urlState';

import { Button } from '../Button';
import { DataTable } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { Select } from '../Select';

import { WORKER_COLUMNS } from './workerColumns';
import { queryDemoWorkers } from './workers';

/**
 * A complete list screen as a feature would build it (stories and tests): sort, filters and page live in the
 * URL through useUrlTableState, and the "server" answers the same query string the API would get.
 */

export interface WorkersTableProps {
  readonly onExport?: (ids: string[]) => void;
}

export function WorkersTable({ onExport }: WorkersTableProps) {
  const state = useUrlTableState({ defaultSort: 'name', pageSize: 10 });
  const { data, total } = queryDemoWorkers(state.apiQuery);
  const nameFilter = filterKey('name', 'like');
  const statusFilter = filterKey('status');

  return (
    <DataTable
      label="Workers"
      columns={WORKER_COLUMNS}
      rows={data}
      getRowId={(w) => w.id}
      getRowLabel={(w) => `${w.name} (${w.code})`}
      sort={state.sort}
      onSortChange={state.onSortChange}
      storageKey="demo-workers"
      pagination={{
        page: state.page,
        pageSize: state.pageSize,
        totalItems: total,
        onPageChange: state.onPageChange,
        onPageSizeChange: state.onPageSizeChange,
        pageSizeOptions: [10, 25, 50],
        itemLabel: 'workers',
      }}
      bulkActions={(ids, clear) => (
        <Button
          size="sm"
          variant="secondary"
          iconStart="download"
          onPress={() => {
            onExport?.(ids);
            clear();
          }}
        >
          Export {ids.length}
        </Button>
      )}
      toolbar={
        <>
          <Input
            label="Search"
            className="w-56"
            placeholder="Name or code"
            value={state.filters[nameFilter] ?? ''}
            onChange={(text) => {
              state.setFilter(nameFilter, text);
            }}
          />
          <Select
            label="Status"
            className="w-40"
            value={state.filters[statusFilter] ?? 'any'}
            options={[
              { id: 'any', label: 'Any status' },
              { id: 'active', label: 'Active' },
              { id: 'disabled', label: 'Disabled' },
            ]}
            onChange={(value) => {
              state.setFilter(statusFilter, value === 'any' ? null : value);
            }}
          />
        </>
      }
      emptyState={
        state.hasFilters ? (
          <EmptyState
            kind="no-results"
            title="No workers match"
            description="Try another name or code, or clear the filters."
            action={
              <Button variant="secondary" onPress={state.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState kind="new" title="No workers yet" />
        )
      }
    />
  );
}
