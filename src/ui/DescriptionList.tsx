import { type ReactNode } from 'react';

import { cx } from './cx';
import { useUiText } from './uiText';

export interface DescriptionItem {
  readonly term: string;
  /** The value. Empty values show an em dash read as "Not set", never a blank. */
  readonly description: ReactNode;
  /** Right-align and use tabular figures (money, quantities, counts). */
  readonly isNumeric?: boolean;
}

export interface DescriptionListProps {
  readonly items: readonly DescriptionItem[];
  /** Columns from md up; always one column on phones. */
  readonly columns?: 1 | 2 | 3;
  /** `stacked` puts the term above the value; `inline` side by side (one column only). */
  readonly layout?: 'stacked' | 'inline';
  readonly className?: string;
}

const COLUMNS = { 1: '', 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 lg:grid-cols-3' } as const;

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === '';
}

/** Labelled values of one record (a worker's details, a voucher's header), as a `<dl>`. */
export function DescriptionList({ items, columns = 1, layout = 'stacked', className }: DescriptionListProps) {
  const text = useUiText();
  return (
    <dl className={cx('grid grid-cols-1 gap-x-6 gap-y-4', COLUMNS[columns], className)}>
      {items.map((item) => (
        <div
          key={item.term}
          className={cx(
            layout === 'inline' ? 'flex items-baseline justify-between gap-4' : 'flex flex-col gap-0.5',
          )}
        >
          <dt className="text-sm text-fg-muted">{item.term}</dt>
          <dd className={cx('text-fg', item.isNumeric && 'text-end figures')}>
            {isEmpty(item.description) ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">{text.notSet}</span>
              </>
            ) : (
              item.description
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
