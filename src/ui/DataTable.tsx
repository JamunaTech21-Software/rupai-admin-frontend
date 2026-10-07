import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';

import { type SortTerm } from '@/lib/urlState';

import { announce } from './announce';
import { Button } from './Button';
import { Checkbox } from './Choice';
import { columnStorageKey, loadHiddenColumns, saveHiddenColumns } from './columnPreferences';
import { ColumnsMenu } from './ColumnsMenu';
import { cx } from './cx';
import { ErrorState, type ErrorStateProps } from './ErrorState';
import { Icon } from './Icon';
import { Pagination, type PaginationProps } from './Pagination';
import { Select } from './Select';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';
import { MD_UP, useMediaQuery } from './useMediaQuery';
import { VisuallyHidden } from './VisuallyHidden';
import { formatCount, useUiText } from './uiText';

export interface DataColumn<TRow> {
  /** Unique id. For a sortable column it is the API's sort field (`created_at`), sent as-is. */
  readonly id: string;
  readonly header: string;
  readonly cell: (row: TRow) => ReactNode;
  /** Money, quantities, counts: right-aligned with tabular figures. */
  readonly isNumeric?: boolean;
  /** Only for fields the API declares sortable (index-backed). */
  readonly isSortable?: boolean;
  /** Whether the user may hide it. The row-header column can never be hidden. */
  readonly canHide?: boolean;
  /** Hidden until the user chooses to show it. */
  readonly isHiddenByDefault?: boolean;
  /** CSS width, e.g. `12rem`. */
  readonly width?: string;
}

export interface DataTableProps<TRow> {
  /** The table's name (its caption): "Workers". */
  readonly label: string;
  /** The first column names each row (its row header): put the record's name or code first. */
  readonly columns: readonly DataColumn<TRow>[];
  readonly rows: readonly TRow[];
  readonly getRowId: (row: TRow) => string;
  /** The row's name for selection and screen readers: "Rahim Uddin (EMP-00042)". */
  readonly getRowLabel?: (row: TRow) => string;

  /** Server-side sort (controlled). Keep it in the URL with `useUrlTableState`. */
  readonly sort?: readonly SortTerm[];
  readonly onSortChange?: (sort: SortTerm[]) => void;

  /** Page-based lists. */
  readonly pagination?: Omit<PaginationProps, 'className'>;
  /** Cursor-based lists (the very-high-growth tables): a "Load more" button instead of pages. */
  readonly loadMore?: {
    readonly hasMore: boolean;
    readonly isLoadingMore: boolean;
    readonly onLoadMore: () => void;
  };

  /** First load, or a new query: shows skeleton rows (or keeps the old rows, dimmed, while refetching). */
  readonly isLoading?: boolean;
  /** The list failed to load: shown in place of the rows. */
  readonly error?: Pick<ErrorStateProps, 'title' | 'message' | 'requestId' | 'onRetry' | 'isRetrying'> | null;
  /** Shown when there are no rows (an EmptyState of the right kind). */
  readonly emptyState?: ReactNode;

  /**
   * Bulk actions for the selected rows. Rows are selectable only when this is given (Spec P5 §6.3): no
   * checkboxes without something to do with them.
   */
  readonly bulkActions?: (selectedIds: string[], clearSelection: () => void) => ReactNode;

  /** Remembers which columns the user hid, per table (and per user once sign-in exists). */
  readonly storageKey?: string;
  readonly userId?: string | null;

  /** Filters and actions above the table. */
  readonly toolbar?: ReactNode;
  /** Height of the scrolling area; the header stays visible inside it. */
  readonly maxHeight?: string;
  readonly className?: string;
}

function toSorting(sort: readonly SortTerm[] | undefined): SortingState {
  return (sort ?? []).map((term) => ({ id: term.id, desc: term.desc }));
}

/** Click order for a column header: ascending, then descending, then back to the default. */
function nextSort(current: readonly SortTerm[], id: string): SortTerm[] {
  const active = current[0];
  if (active?.id !== id) return [{ id, desc: false }];
  if (!active.desc) return [{ id, desc: true }];
  return [];
}

function initialVisibility<TRow>(columns: readonly DataColumn<TRow>[], key: string | null): VisibilityState {
  const saved = key ? loadHiddenColumns(key) : null;
  return Object.fromEntries(
    columns.map((column, index) => {
      if (index === 0) return [column.id, true];
      const hidden = saved ? saved.includes(column.id) : Boolean(column.isHiddenByDefault);
      return [column.id, !hidden];
    }),
  );
}

/**
 * The list screen's table (Spec P5 §6.3), headless on TanStack Table. Sorting, filtering and paging happen on
 * the server: the table only shows `rows` and reports what the user asked for. Header and first column stay in
 * view while scrolling; numbers are right-aligned; below md the rows become cards.
 */
export function DataTable<TRow>({
  label,
  columns,
  rows,
  getRowId,
  getRowLabel,
  sort,
  onSortChange,
  pagination,
  loadMore,
  isLoading = false,
  error,
  emptyState,
  bulkActions,
  storageKey,
  userId,
  toolbar,
  maxHeight = '70dvh',
  className,
}: DataTableProps<TRow>) {
  const text = useUiText();
  const captionId = useId();
  const isWide = useMediaQuery(MD_UP);
  const storeKey = storageKey ? columnStorageKey(storageKey, userId) : null;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    initialVisibility(columns, storeKey),
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectable = Boolean(bulkActions);

  // A new page or query replaces the rows: drop selections that are no longer on screen.
  const rowIds = rows.map(getRowId).join('|');
  useEffect(() => {
    setRowSelection({});
  }, [rowIds]);

  const columnDefs = useMemo<ColumnDef<TRow>[]>(
    () =>
      columns.map((column, index) => ({
        id: column.id,
        header: column.header,
        cell: (info) => column.cell(info.row.original),
        enableSorting: Boolean(column.isSortable),
        enableHiding: index > 0 && column.canHide !== false,
      })),
    [columns],
  );

  // TanStack Table returns new functions each render; nothing here memoizes them, so the compiler's caution
  // does not apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows as TRow[],
    columns: columnDefs,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    enableRowSelection: selectable,
    state: { sorting: toSorting(sort), columnVisibility, rowSelection },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const clearSelection = () => {
    setRowSelection({});
  };
  const rowLabel = (row: TRow) => getRowLabel?.(row) ?? getRowId(row);
  const visibleColumns = columns.filter((column) => columnVisibility[column.id] !== false);
  const byId = new Map(columns.map((column) => [column.id, column]));

  function setVisible(visible: Set<string>) {
    const next: VisibilityState = Object.fromEntries(
      columns.map((column, index) => [column.id, index === 0 || visible.has(column.id)]),
    );
    setColumnVisibility(next);
    if (storeKey) {
      saveHiddenColumns(
        storeKey,
        columns.filter((column) => !next[column.id]).map((column) => column.id),
      );
    }
  }

  function toggleRow(id: string, selected: boolean) {
    const next: RowSelectionState = Object.fromEntries(
      Object.entries(rowSelection).filter(([key, isOn]) => isOn && key !== id),
    );
    if (selected) next[id] = true;
    setRowSelection(next);
    announce(`${text.selectedCount(formatCount(Object.keys(next).length, text))}.`);
  }

  const allOnPage = rows.length > 0 && selectedIds.length === rows.length;
  const someOnPage = selectedIds.length > 0 && !allOnPage;
  function toggleAll(selected: boolean) {
    setRowSelection(selected ? Object.fromEntries(rows.map((row) => [getRowId(row), true])) : {});
    announce(selected ? text.allOnPageSelected(formatCount(rows.length, text)) : text.selectionCleared);
  }

  const sortTerm = sort?.[0];
  const sortable = columns.filter((column) => column.isSortable);
  const isEmpty = !isLoading && !error && rows.length === 0;
  const isRefetching = isLoading && rows.length > 0;

  // ---- Pieces --------------------------------------------------------------------------------------------

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* On a phone the filters take the whole row; sort and columns wrap below them. */}
      <div className="flex min-w-0 basis-full flex-wrap items-end gap-3 sm:flex-1 sm:basis-0">{toolbar}</div>
      <div className="flex items-end gap-2">
        {!isWide && sortable.length > 0 && onSortChange ? (
          <Select
            label={text.sortBy}
            className="w-48"
            value={sortTerm ? `${sortTerm.id}:${sortTerm.desc ? 'desc' : 'asc'}` : null}
            options={sortable.flatMap((column) => [
              { id: `${column.id}:asc`, label: text.sortOption(column.header, false) },
              { id: `${column.id}:desc`, label: text.sortOption(column.header, true) },
            ])}
            onChange={(value) => {
              if (!value) return;
              const [id = '', direction] = value.split(':');
              onSortChange([{ id, desc: direction === 'desc' }]);
            }}
          />
        ) : null}
        {columns.slice(1).some((column) => column.canHide !== false) ? (
          <ColumnsMenu
            columns={columns.map((column, index) => ({
              id: column.id,
              label: column.header,
              canHide: index > 0 && column.canHide !== false,
            }))}
            visible={new Set(visibleColumns.map((column) => column.id))}
            onVisibleChange={setVisible}
          />
        ) : null}
      </div>
    </div>
  );

  const bulkBar =
    selectable && selectedIds.length > 0 ? (
      <div
        role="region"
        aria-label={text.bulkActions}
        className="flex flex-wrap items-center gap-3 rounded-md border border-primary bg-primary-subtle px-3 py-2"
      >
        <span className="font-medium text-primary-strong figures">
          {text.selectedCount(formatCount(selectedIds.length, text))}
        </span>
        {bulkActions?.(selectedIds, clearSelection)}
        <Button variant="ghost" size="sm" onPress={clearSelection}>
          {text.clearSelection}
        </Button>
      </div>
    ) : null;

  const footer = error ? null : pagination ? (
    <Pagination {...pagination} />
  ) : loadMore ? (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-fg-muted figures" aria-live="polite">
        Showing {rows.length}
        {loadMore.hasMore ? '' : ' (all)'}
      </p>
      {loadMore.hasMore ? (
        <Button variant="secondary" isPending={loadMore.isLoadingMore} onPress={loadMore.onLoadMore}>
          {text.loadMore}
        </Button>
      ) : null}
    </div>
  ) : null;

  function sortHeader(column: DataColumn<TRow>) {
    const active = sortTerm?.id === column.id ? sortTerm : undefined;
    if (!column.isSortable || !onSortChange) return column.header;
    return (
      <AriaButton
        onPress={() => {
          onSortChange(nextSort(sort ?? [], column.id));
        }}
        className={cx(
          'inline-flex items-center gap-1 rounded-sm outline-none data-hovered:text-fg',
          'data-focus-visible:outline-2 data-focus-visible:outline-focus',
          column.isNumeric && 'flex-row-reverse',
        )}
      >
        {column.header}
        <Icon
          name={active ? (active.desc ? 'chevronDown' : 'chevronUp') : 'sortable'}
          size="sm"
          className={active ? 'text-primary' : 'text-fg-subtle'}
        />
      </AriaButton>
    );
  }

  // ---- Body: error, empty, loading, rows ------------------------------------------------------------------

  let body: ReactNode;
  if (error) {
    body = <ErrorState {...error} title={error.title ?? text.loadFailed(label)} />;
  } else if (isEmpty) {
    body = emptyState ?? <p className="px-4 py-8 text-center text-fg-muted">{text.noRows(label)}</p>;
  } else if (!isWide) {
    body = (
      <ul
        aria-label={label}
        aria-busy={isLoading}
        className={cx('flex flex-col gap-2', isRefetching && 'opacity-60')}
      >
        {isLoading && rows.length === 0
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <Skeleton variant="text" lines={3} />
              </li>
            ))
          : table.getRowModel().rows.map((row) => {
              const [first, ...rest] = visibleColumns;
              const id = row.id;
              return (
                <li
                  key={id}
                  className={cx(
                    'flex gap-3 rounded-lg border bg-surface p-3',
                    row.getIsSelected() ? 'border-primary' : 'border-line',
                  )}
                >
                  {selectable ? (
                    <Checkbox
                      isSelected={row.getIsSelected()}
                      onChange={(selected) => {
                        toggleRow(id, selected);
                      }}
                    >
                      <VisuallyHidden>{text.selectRow(rowLabel(row.original))}</VisuallyHidden>
                    </Checkbox>
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {first ? <div className="font-medium text-fg">{first.cell(row.original)}</div> : null}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      {rest.map((column) => (
                        <div key={column.id} className="contents">
                          <dt className="text-fg-muted">{column.header}</dt>
                          <dd className={cx('text-fg', column.isNumeric && 'text-end figures')}>
                            {column.cell(row.original)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </li>
              );
            })}
      </ul>
    );
  } else {
    body = (
      <div
        role="region"
        aria-labelledby={captionId}
        // Scrollable regions must be reachable by keyboard (WCAG 2.1.1).
        tabIndex={0}
        style={{ maxHeight }}
        className="relative overflow-auto rounded-lg border border-line bg-surface outline-none focus-visible:outline-2 focus-visible:outline-focus"
      >
        <table
          aria-busy={isLoading}
          className={cx('w-full border-separate border-spacing-0 text-start', isRefetching && 'opacity-60')}
        >
          <caption id={captionId} className="sr-only">
            {label}
          </caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {selectable ? (
                  <th
                    scope="col"
                    className="sticky start-0 top-0 z-3 w-10 border-b border-line bg-surface-subtle px-3 py-2"
                  >
                    <Checkbox isSelected={allOnPage} isIndeterminate={someOnPage} onChange={toggleAll}>
                      <VisuallyHidden>{text.selectAllOnPage}</VisuallyHidden>
                    </Checkbox>
                  </th>
                ) : null}
                {group.headers.map((headerCell, index) => {
                  const column = byId.get(headerCell.column.id);
                  if (!column) return null;
                  const active = sortTerm?.id === column.id ? sortTerm : undefined;
                  return (
                    <th
                      key={headerCell.id}
                      scope="col"
                      {...(column.isSortable
                        ? { 'aria-sort': active ? (active.desc ? 'descending' : 'ascending') : 'none' }
                        : {})}
                      style={column.width ? { width: column.width } : undefined}
                      className={cx(
                        'sticky top-0 z-2 border-b border-line bg-surface-subtle px-3 py-2 text-sm font-semibold whitespace-nowrap text-fg-muted',
                        column.isNumeric ? 'text-end' : 'text-start',
                        index === 0 && 'start-0 z-3',
                        index === 0 && selectable && 'start-10',
                      )}
                    >
                      {sortHeader(column)}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="p-0">
                  <Skeleton variant="table-row" columns={visibleColumns.length} rows={5} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  {...(selectable ? { 'aria-selected': row.getIsSelected() } : {})}
                  className={cx(
                    'group',
                    row.getIsSelected() ? 'bg-primary-subtle' : 'hover:bg-surface-subtle',
                  )}
                >
                  {selectable ? (
                    <td
                      className={cx(
                        'sticky start-0 z-1 w-10 border-b border-line px-3 py-2',
                        row.getIsSelected()
                          ? 'bg-primary-subtle'
                          : 'bg-surface group-hover:bg-surface-subtle',
                      )}
                    >
                      <Checkbox
                        isSelected={row.getIsSelected()}
                        onChange={(selected) => {
                          toggleRow(row.id, selected);
                        }}
                      >
                        <VisuallyHidden>{text.selectRow(rowLabel(row.original))}</VisuallyHidden>
                      </Checkbox>
                    </td>
                  ) : null}
                  {row.getVisibleCells().map((cell, index) => {
                    const column = byId.get(cell.column.id);
                    const Cell = index === 0 ? 'th' : 'td';
                    return (
                      <Cell
                        key={cell.id}
                        {...(index === 0 ? { scope: 'row' } : {})}
                        className={cx(
                          'border-b border-line px-3 py-2 text-start align-middle font-normal text-fg',
                          column?.isNumeric && 'text-end figures',
                          index === 0 &&
                            'sticky start-0 z-1 bg-surface font-medium group-hover:bg-surface-subtle',
                          index === 0 && selectable && 'start-10',
                          index === 0 &&
                            row.getIsSelected() &&
                            'bg-primary-subtle group-hover:bg-primary-subtle',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Cell>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {isRefetching ? (
          <span className="absolute end-3 top-3">
            <Spinner size="sm" label={text.updating} />
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      {header}
      {bulkBar}
      {body}
      {footer}
    </div>
  );
}
