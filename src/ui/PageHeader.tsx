import { type ReactNode } from 'react';
import { Breadcrumb, Breadcrumbs as AriaBreadcrumbs, Link as AriaLink } from 'react-aria-components';

import { Badge, type BadgeTone } from './Badge';
import { cx } from './cx';
import { Icon } from './Icon';
import { useUiText } from './uiText';

export interface Crumb {
  readonly label: string;
  /** Leave out for the current page (the last crumb). */
  readonly href?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly Crumb[];
  readonly className?: string;
}

/** Where this page sits: "Workers › Rahim Uddin". The last item is the current page. */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const text = useUiText();
  return (
    <nav aria-label={text.breadcrumbs} className={className}>
      <AriaBreadcrumbs className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <Breadcrumb key={`${item.label}-${String(index)}`} className="flex items-center gap-1">
              <AriaLink
                {...(item.href && !isCurrent ? { href: item.href } : {})}
                className={cx(
                  'rounded-sm outline-none',
                  isCurrent
                    ? 'font-medium text-fg'
                    : 'text-fg-muted underline-offset-2 data-hovered:underline',
                  'data-focus-visible:outline-2 data-focus-visible:outline-focus',
                )}
              >
                {item.label}
              </AriaLink>
              {isCurrent ? null : <Icon name="chevronRight" size="sm" className="text-fg-subtle" />}
            </Breadcrumb>
          );
        })}
      </AriaBreadcrumbs>
    </nav>
  );
}

export interface PageHeaderProps {
  /** The page's one h1. */
  readonly title: string;
  /** The record's state next to the title: "Approved". */
  readonly status?: { readonly tone: BadgeTone; readonly label: string };
  /** One line under the title: a code, a period, a count. */
  readonly description?: ReactNode;
  readonly breadcrumbs?: readonly Crumb[];
  /** The page's actions, primary last: "Export", "Approve". */
  readonly actions?: ReactNode;
  readonly className?: string;
}

/** The top of every page (Spec P5 §6.5): where you are, what this is, its state, and what you can do. */
export function PageHeader({ title, status, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-fg">{title}</h1>
            {status ? <Badge tone={status.tone} label={status.label} /> : null}
          </div>
          {description ? <div className="text-fg-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
