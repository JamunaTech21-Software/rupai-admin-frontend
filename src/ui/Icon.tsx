import { cx } from './cx';
import { type IconName, icons } from './iconSet';

const SIZE = { sm: 'size-4', md: 'size-5', lg: 'size-6' } as const;

export interface IconProps {
  readonly name: IconName;
  readonly size?: keyof typeof SIZE;
  /**
   * Name the icon only when it carries meaning on its own (no visible text next to it). Without a label the
   * icon is decorative and hidden from assistive technology.
   */
  readonly label?: string;
  readonly className?: string;
}

/** An icon from the set. Decorative by default; give it a `label` when nothing else names it. */
export function Icon({ name, size = 'md', label, className }: IconProps) {
  const Svg = icons[name];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <Svg {...a11y} focusable={false} strokeWidth={2} className={cx(SIZE[size], 'shrink-0', className)} />
  );
}
