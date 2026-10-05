import { type ReactNode, useId } from 'react';

import { cx } from './cx';

export interface CardProps {
  /** The heading. When given, the card is a labelled region a screen reader can jump to. */
  readonly title?: string;
  /** Heading level within the page outline; cards on a page are usually h2 or h3. */
  readonly headingLevel?: 2 | 3 | 4;
  readonly description?: string;
  /** Buttons or a menu at the top end ("Edit"). */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** `none` for content that runs edge to edge (a table, a list). */
  readonly padding?: 'none' | 'md';
  readonly className?: string;
}

/** A bordered surface grouping related content: a record's section, a summary, a chart. */
export function Card({
  title,
  headingLevel = 2,
  description,
  actions,
  children,
  footer,
  padding = 'md',
  className,
}: CardProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      {...(title ? { 'aria-labelledby': headingId } : {})}
      className={cx('flex flex-col rounded-lg border border-line bg-surface shadow-sm', className)}
    >
      {title || actions ? (
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? (
              <Heading id={headingId} className="text-base font-semibold text-fg">
                {title}
              </Heading>
            ) : null}
            {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx('flex-1', padding === 'md' && 'p-4')}>{children}</div>
      {footer ? <div className="border-t border-line px-4 py-3">{footer}</div> : null}
    </section>
  );
}
