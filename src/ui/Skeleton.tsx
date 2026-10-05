import { cx } from './cx';

const pulse = 'animate-pulse rounded-sm bg-surface-subtle motion-reduce:animate-none';

export type SkeletonProps =
  | {
      /** Lines of text; the last one is shorter, like a paragraph. */
      readonly variant: 'text';
      readonly lines?: number;
      readonly className?: string;
    }
  | {
      /** A block (an image, a card, a chart), sized with `className`, e.g. `h-40 w-full`. */
      readonly variant: 'block';
      readonly className?: string;
    }
  | {
      /** Table rows matching the real table's columns, so the layout does not jump when data arrives. */
      readonly variant: 'table-row';
      readonly columns: number;
      readonly rows?: number;
      readonly className?: string;
    };

/**
 * A placeholder shown while content loads (the loading interface state, Spec P5 §8). It is hidden from
 * assistive technology: mark the region that is loading with `aria-busy="true"`, and announce the result.
 */
export function Skeleton(props: SkeletonProps) {
  if (props.variant === 'text') {
    const lines = props.lines ?? 3;
    return (
      <div aria-hidden="true" className={cx('space-y-2', props.className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cx(pulse, 'h-4', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    );
  }

  if (props.variant === 'block') {
    return <div aria-hidden="true" className={cx(pulse, 'rounded-lg', props.className ?? 'h-24 w-full')} />;
  }

  const rows = props.rows ?? 3;
  return (
    <div aria-hidden="true" className={cx('divide-y divide-line', props.className)}>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-4 px-3 py-3"
          style={{ gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: props.columns }, (_, c) => (
            <div key={c} className={cx(pulse, 'h-4', c === 0 ? 'w-3/4' : 'w-1/2')} />
          ))}
        </div>
      ))}
    </div>
  );
}
