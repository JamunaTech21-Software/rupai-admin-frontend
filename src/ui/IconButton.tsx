import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

import { buttonBase, buttonVariants, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { cx } from './cx';
import { Icon } from './Icon';
import { type IconName } from './iconSet';
import { Spinner } from './Spinner';

/** Square sizes from md up; below md every button is at least 44 × 44 px (base.css). */
const SIZE: Record<ButtonSize, string> = {
  sm: 'md:size-8',
  md: 'md:size-(--size-control)',
  lg: 'md:size-(--size-touch-target)',
};

export interface IconButtonProps extends Omit<
  AriaButtonProps,
  'children' | 'className' | 'style' | 'aria-label'
> {
  readonly icon: IconName;
  /** Required: the accessible name, e.g. "Close", "Delete worker". It is what a screen reader says. */
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly isPending?: boolean;
  readonly className?: string;
}

/**
 * A button whose only visible content is an icon. The `label` is required and becomes the accessible name; a
 * Tooltip (F0.05) shows the same text on hover and focus.
 */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  isPending = false,
  className,
  ...props
}: IconButtonProps) {
  if (import.meta.env.DEV && label.trim() === '') {
    throw new Error('IconButton needs a non-empty `label`: it is the only name assistive technology gets.');
  }
  const iconSize = size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm';
  return (
    <AriaButton
      {...props}
      aria-label={label}
      isPending={isPending}
      className={cx(buttonBase, buttonVariants[variant], SIZE[size], 'p-0', className)}
    >
      {isPending ? <Spinner size={iconSize} label={null} /> : <Icon name={icon} size={iconSize} />}
    </AriaButton>
  );
}
