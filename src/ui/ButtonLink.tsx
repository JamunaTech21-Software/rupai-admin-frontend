import { type ReactNode } from 'react';
import { Link as AriaLink } from 'react-aria-components';

import { buttonBase, buttonVariants, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { cx } from './cx';
import { Icon } from './Icon';
import { type IconName } from './iconSet';

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 min-h-(--size-touch-target) md:min-h-0 md:h-8',
  md: 'text-base px-4 min-h-(--size-touch-target) md:min-h-0 md:h-(--size-control)',
  lg: 'text-lg px-5 min-h-(--size-touch-target)',
};

export interface ButtonLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconStart?: IconName;
  readonly className?: string;
}

/**
 * Navigation that looks like a button: the page's main way into another screen ("Add user" opens the form).
 * It is a link (it goes somewhere), so screen readers announce it as one; for an action use Button.
 */
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  iconStart,
  className,
}: ButtonLinkProps) {
  return (
    <AriaLink href={href} className={cx(buttonBase, buttonVariants[variant], SIZE[size], className)}>
      {iconStart ? <Icon name={iconStart} size={size === 'lg' ? 'md' : 'sm'} /> : null}
      <span className="inline-flex min-w-0 items-center gap-2">{children}</span>
    </AriaLink>
  );
}
