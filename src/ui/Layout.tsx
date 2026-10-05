import { type ElementType, type ReactNode } from 'react';
import { Toolbar as AriaToolbar } from 'react-aria-components';

import { cx } from './cx';

/**
 * Layout helpers (Spec P5 §6.5): spacing between things comes from these, never from margins on the things
 * themselves. Gaps use the spacing scale.
 */

const GAP = { 0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 6: 'gap-6', 8: 'gap-8' } as const;
export type Gap = keyof typeof GAP;

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
} as const;
const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

interface BoxProps {
  readonly children: ReactNode;
  readonly gap?: Gap;
  /** The element to render: `section`, `ul`… Defaults to `div`. */
  readonly as?: ElementType;
  readonly className?: string;
}

/** Things one above the other: form sections, cards on a page. */
export function Stack({
  children,
  gap = 4,
  as: As = 'div',
  align = 'stretch',
  className,
}: BoxProps & {
  readonly align?: keyof typeof ALIGN;
}) {
  return <As className={cx('flex flex-col', GAP[gap], ALIGN[align], className)}>{children}</As>;
}

/** Things side by side that wrap when space runs out: buttons, tags, filters. */
export function Inline({
  children,
  gap = 2,
  as: As = 'div',
  align = 'center',
  justify = 'start',
  wrap = true,
  className,
}: BoxProps & {
  readonly align?: keyof typeof ALIGN;
  readonly justify?: keyof typeof JUSTIFY;
  readonly wrap?: boolean;
}) {
  return (
    <As className={cx('flex', wrap && 'flex-wrap', GAP[gap], ALIGN[align], JUSTIFY[justify], className)}>
      {children}
    </As>
  );
}

const COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const;

/**
 * A responsive grid: one column on phones, up to `columns` on wide screens. With `minItemWidth` the number of
 * columns follows the space instead (`16rem` cards fill the row).
 */
export function Grid({
  children,
  gap = 4,
  as: As = 'div',
  columns = 3,
  minItemWidth,
  className,
}: BoxProps & { readonly columns?: keyof typeof COLUMNS; readonly minItemWidth?: string }) {
  return (
    <As
      className={cx('grid', GAP[gap], !minItemWidth && COLUMNS[columns], className)}
      style={
        minItemWidth
          ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(${minItemWidth}, 100%), 1fr))` }
          : undefined
      }
    >
      {children}
    </As>
  );
}

export interface ToolbarProps {
  /** The group's accessible name: "Muster actions", "Text formatting". */
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A row of related controls (Spec P5 §6.5) announced as a toolbar: Tab enters it once and the arrow keys move
 * between its buttons, so a long row of actions costs one Tab stop.
 */
export function Toolbar({ label, children, className }: ToolbarProps) {
  return (
    <AriaToolbar aria-label={label} className={cx('flex flex-wrap items-center gap-2', className)}>
      {children}
    </AriaToolbar>
  );
}
