import { Separator } from 'react-aria-components';

import { cx } from './cx';

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical';
  /**
   * A purely visual line (between items in a toolbar, say) is hidden from assistive technology. Leave this off
   * when the line separates sections of content, so it is announced as a separator.
   */
  readonly decorative?: boolean;
  readonly className?: string;
}

/** A thin line between groups of content. */
export function Divider({ orientation = 'horizontal', decorative = false, className }: DividerProps) {
  const classes = cx(
    'shrink-0 border-0 bg-line',
    orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch',
    className,
  );
  if (decorative) return <div aria-hidden="true" className={classes} />;
  return <Separator orientation={orientation} className={classes} />;
}
