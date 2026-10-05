import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Shared by Button and IconButton. State styles use React Aria's data attributes (hover, press, focus). */
export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-fg-on-primary border-transparent data-hovered:bg-primary-hover data-pressed:bg-primary-hover',
  secondary:
    'bg-surface text-fg border-line-strong data-hovered:bg-surface-subtle data-pressed:bg-surface-subtle',
  ghost:
    'bg-transparent text-primary border-transparent data-hovered:bg-primary-subtle data-pressed:bg-primary-subtle',
  danger:
    'bg-danger text-fg-on-primary border-transparent data-hovered:brightness-90 data-pressed:brightness-90',
};

export const buttonBase = cx(
  'relative inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap select-none',
  'transition-colors duration-(--duration-fast) ease-(--ease-standard)',
  'data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus',
  'data-disabled:cursor-not-allowed data-disabled:opacity-50',
  'data-pending:cursor-wait',
);
