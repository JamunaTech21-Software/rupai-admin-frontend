import { type ReactNode } from 'react';
import { Link as AriaLink, type LinkProps as AriaLinkProps } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';
import { VisuallyHidden } from './VisuallyHidden';

export interface LinkProps extends Omit<
  AriaLinkProps,
  'children' | 'className' | 'style' | 'target' | 'rel'
> {
  readonly href: string;
  readonly children: ReactNode;
  /**
   * `inline` (default) sits inside running text and is always underlined, so it is not identified by colour
   * alone. `standalone` stands on its own line (a "View all" link) and is underlined on hover.
   */
  readonly variant?: 'inline' | 'standalone';
  /** Opens in a new tab, with an icon and "(opens in a new tab)" for screen readers. */
  readonly isExternal?: boolean;
  readonly className?: string;
}

/**
 * Navigation to another page. In-app links navigate without a reload through UiProvider. For an action that
 * changes data, use a Button, never a Link.
 */
export function Link({ children, variant = 'inline', isExternal = false, className, ...props }: LinkProps) {
  return (
    <AriaLink
      {...props}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cx(
        'inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4',
        'data-hovered:text-primary-hover data-pressed:text-primary-hover',
        'data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus',
        'data-disabled:cursor-not-allowed data-disabled:text-fg-subtle data-disabled:no-underline',
        variant === 'inline'
          ? 'underline'
          : // On its own line it is a touch target: at least 44 px tall below md.
            'min-h-(--size-touch-target) data-hovered:underline md:min-h-0',
        className,
      )}
    >
      {children}
      {isExternal ? (
        <>
          <Icon name="external" size="sm" />
          <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
        </>
      ) : null}
    </AriaLink>
  );
}
