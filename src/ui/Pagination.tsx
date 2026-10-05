import { Button as AriaButton } from 'react-aria-components';

import { cx } from './cx';
import { IconButton } from './IconButton';
import { pageWindow } from './pageWindow';
import { Select } from './Select';
import { formatCount, useUiText } from './uiText';

export interface PaginationProps {
  /** The current page, from 1. */
  readonly page: number;
  readonly pageSize: number;
  /** All matching rows on the server (the list response's total). */
  readonly totalItems: number;
  readonly onPageChange: (page: number) => void;
  /** Shows a rows-per-page choice. */
  readonly onPageSizeChange?: (pageSize: number) => void;
  readonly pageSizeOptions?: readonly number[];
  /** What the rows are, for the summary: "workers". */
  readonly itemLabel?: string;
  readonly className?: string;
}

/**
 * Page through a server-paginated list (Spec P5 §6.3). Keep page and size in the URL:
 * `<Pagination {...useUrlPage()} totalItems={data.total} />` (lib/urlState). For cursor-paginated lists use
 * the DataTable's load-more variant instead.
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  itemLabel,
  className,
}: PaginationProps) {
  const text = useUiText();
  const items = itemLabel ?? text.rows;
  const n = (value: number) => formatCount(value, text);
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, totalItems);

  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3 text-sm', className)}>
      <p className="text-fg-muted figures" aria-live="polite">
        {totalItems === 0 ? text.noItems(items) : text.range(n(first), n(last), n(totalItems), items)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <Select
            label={text.rowsPerPage}
            hideLabel
            className="w-24"
            value={String(pageSize)}
            options={pageSizeOptions.map((size) => ({ id: String(size), label: String(size) }))}
            onChange={(value) => {
              if (value) onPageSizeChange(Number.parseInt(value, 10));
            }}
          />
        ) : null}
        <nav aria-label={text.pagination} className="flex items-center gap-1">
          <IconButton
            icon="chevronLeft"
            label={text.previousPage}
            variant="ghost"
            size="sm"
            isDisabled={current <= 1}
            onPress={() => {
              onPageChange(current - 1);
            }}
          />
          <ul className="hidden items-center gap-1 sm:flex">
            {pageWindow(current, pageCount).map((p, i) =>
              p === null ? (
                <li key={`gap-${String(i)}`} aria-hidden="true" className="px-1 text-fg-muted">
                  …
                </li>
              ) : (
                <li key={p}>
                  <AriaButton
                    aria-label={text.pageNumber(n(p))}
                    {...(p === current ? { 'aria-current': 'page' as const } : {})}
                    onPress={() => {
                      onPageChange(p);
                    }}
                    className={cx(
                      'flex min-w-8 items-center justify-center rounded-md px-2 py-1 figures outline-none',
                      'data-hovered:bg-surface-subtle',
                      'data-focus-visible:outline-2 data-focus-visible:outline-focus',
                      p === current
                        ? 'bg-primary text-fg-on-primary data-hovered:bg-primary-hover'
                        : 'text-fg',
                    )}
                  >
                    {p}
                  </AriaButton>
                </li>
              ),
            )}
          </ul>
          <span className="px-2 text-fg-muted figures sm:hidden">
            {text.pageOf(n(current), n(pageCount))}
          </span>
          <IconButton
            icon="chevronRight"
            label={text.nextPage}
            variant="ghost"
            size="sm"
            isDisabled={current >= pageCount}
            onPress={() => {
              onPageChange(current + 1);
            }}
          />
        </nav>
      </div>
    </div>
  );
}
