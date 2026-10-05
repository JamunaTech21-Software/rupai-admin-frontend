import { type ReactNode } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

import { buttonBase, buttonVariants, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { cx } from './cx';
import { Icon } from './Icon';
import { type IconName } from './iconSet';
import { Spinner } from './Spinner';

/** Heights from md up. Below md every button is at least 44 px tall (base.css). */
const SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 md:h-8',
  md: 'text-base px-4 md:h-(--size-control)',
  lg: 'text-lg px-5 md:h-(--size-touch-target)',
};

export interface ButtonProps extends Omit<AriaButtonProps, 'children' | 'className' | 'style'> {
  /** The visible label. Always text: a button without words is an IconButton. */
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** An icon before the label (decorative: the label names the action). */
  readonly iconStart?: IconName;
  readonly iconEnd?: IconName;
  /**
   * While the action runs: shows a spinner beside the label (the label stays, so the button keeps its width and
   * name), blocks further presses, keeps focus, and announces the busy state.
   */
  readonly isPending?: boolean;
  readonly fullWidth?: boolean;
  readonly className?: string;
}

/**
 * The button for every action. One primary button per view; destructive actions use `danger` and a
 * ConfirmDialog (F0.05) that names the consequence.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconStart,
  iconEnd,
  isPending = false,
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  const iconSize = size === 'lg' ? 'md' : 'sm';
  return (
    <AriaButton
      {...props}
      isPending={isPending}
      className={cx(buttonBase, buttonVariants[variant], SIZE[size], fullWidth && 'w-full', className)}
    >
      {isPending ? (
        <Spinner size={iconSize} label={null} />
      ) : (
        iconStart && <Icon name={iconStart} size={iconSize} />
      )}
      <span>{children}</span>
      {iconEnd && !isPending ? <Icon name={iconEnd} size={iconSize} /> : null}
    </AriaButton>
  );
}
