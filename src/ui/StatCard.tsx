import { cx } from './cx';
import { Icon } from './Icon';
import { Link } from './Link';

export interface StatComparison {
  /** Which way the number moved. */
  readonly direction: 'up' | 'down' | 'flat';
  /** Whether that is good news here: a rise in cost is negative, a rise in yield positive. */
  readonly sentiment: 'positive' | 'negative' | 'neutral';
  /** The comparison in words, read out in full: "12% more than last week". */
  readonly text: string;
}

/**
 * Where the number comes from, as a link to the list or report it summarises, already filtered: "View the 14
 * pending musters". The figure is never a dead end (Spec P5 §6.3).
 */
export interface StatDrillDown {
  readonly href: string;
  readonly label: string;
}

export interface StatCardProps {
  /** What is counted: "Leaf plucked today". */
  readonly label: string;
  /**
   * The figure, already formatted for display: "12,480.5", "৳3,04,062.50", "14". Money and quantities come from
   * formatDecimal, never from a float.
   */
  readonly value: string;
  /** A unit after the value: "kg", "workers". */
  readonly unit?: string;
  readonly comparison?: StatComparison;
  readonly drillDown?: StatDrillDown;
  readonly className?: string;
}

const DIRECTION_ICON = { up: 'trendUp', down: 'trendDown', flat: 'minus' } as const;
const SENTIMENT = { positive: 'text-success', negative: 'text-danger', neutral: 'text-fg-muted' } as const;

/** One headline figure on a dashboard, with how it compares and a link to the detail behind it. */
export function StatCard({ label, value, unit, comparison, drillDown, className }: StatCardProps) {
  return (
    <div
      className={cx('flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-sm', className)}
    >
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-fg figures">{value}</span>
        {unit ? <span className="text-sm text-fg-muted">{unit}</span> : null}
      </p>
      {comparison ? (
        <p className={cx('flex items-center gap-1 text-sm', SENTIMENT[comparison.sentiment])}>
          <Icon name={DIRECTION_ICON[comparison.direction]} size="sm" />
          <span>{comparison.text}</span>
        </p>
      ) : null}
      {drillDown ? (
        <Link href={drillDown.href} variant="standalone" className="mt-auto text-sm">
          {drillDown.label}
        </Link>
      ) : null}
    </div>
  );
}
