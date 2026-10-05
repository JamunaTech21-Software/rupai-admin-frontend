import { type ReactNode } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';
import { type IconName } from './iconSet';

/**
 * The three kinds of empty (Spec P5 §8), which need different words and a different next step:
 *
 * - `new`: nothing has been created yet ("No gangs yet"). Explain what goes here; offer to create the first.
 * - `no-results`: there is data, but the search or filters match none. Offer to clear the filters.
 * - `done`: a work queue is empty because everything is dealt with ("No musters waiting for approval"). Good
 *   news; usually no action.
 * - `scope`: there are records, but none inside the estates this user may see (Spec P5 §8 "scope emptiness").
 *   Say whose scope it is, so the user does not think the data is missing.
 */
export type EmptyKind = 'new' | 'no-results' | 'done' | 'scope';

const KIND: Record<EmptyKind, { icon: IconName; className: string }> = {
  new: { icon: 'folderOpen', className: 'bg-primary-subtle text-primary' },
  'no-results': { icon: 'search', className: 'bg-surface-subtle text-fg-muted' },
  done: { icon: 'checkCircle', className: 'bg-success-subtle text-success' },
  scope: { icon: 'mapPin', className: 'bg-info-subtle text-info' },
};

export interface EmptyStateProps {
  readonly kind: EmptyKind;
  readonly title: string;
  readonly description?: string;
  /** The next step: "Add gang" for `new`, "Clear filters" for `no-results`. */
  readonly action?: ReactNode;
  /** `page` fills the content area; `inline` sits inside a card or table. */
  readonly size?: 'page' | 'inline';
  /** Heading level within the page outline. */
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

/** What a region shows when it has nothing to show, and what to do next. */
export function EmptyState({
  kind,
  title,
  description,
  action,
  size = 'inline',
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 text-center',
        size === 'page' ? 'px-4 py-16' : 'px-4 py-8',
        className,
      )}
    >
      <span className={cx('flex size-12 items-center justify-center rounded-full', KIND[kind].className)}>
        <Icon name={KIND[kind].icon} size="lg" />
      </span>
      <Heading className={cx('font-semibold text-fg', size === 'page' ? 'text-xl' : 'text-lg')}>
        {title}
      </Heading>
      {description ? <p className="max-w-prose text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
