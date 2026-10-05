import { Label, ProgressBar as AriaProgressBar } from 'react-aria-components';

import { cx } from './cx';

const TONE = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

export interface ProgressBarProps {
  /** Required: what is progressing ("Importing workers"). The accessible name. */
  readonly label: string;
  /** Hide the label visually when the context already says it; it is still read out. */
  readonly hideLabel?: boolean;
  /** Done so far, between minValue and maxValue. Leave out for an indeterminate bar. */
  readonly value?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  /** Text instead of the percentage: "1,240 of 3,000 rows". */
  readonly valueLabel?: string;
  readonly tone?: keyof typeof TONE;
  readonly className?: string;
}

/**
 * Progress of a task with a known size: an import, an upload, a payroll run. Announced as a progress bar with
 * its value. With no `value` it shows an indeterminate bar (prefer a Spinner for a short wait).
 */
export function ProgressBar({
  label,
  hideLabel = false,
  value,
  minValue = 0,
  maxValue = 100,
  valueLabel,
  tone = 'primary',
  className,
}: ProgressBarProps) {
  const isIndeterminate = value === undefined;
  return (
    <AriaProgressBar
      {...(isIndeterminate ? { isIndeterminate } : { value })}
      minValue={minValue}
      maxValue={maxValue}
      {...(valueLabel ? { valueLabel } : {})}
      className={cx('flex flex-col gap-1', className)}
    >
      {({ percentage, valueText }) => (
        <>
          <span className={cx('flex justify-between gap-3 text-sm', hideLabel && 'sr-only')}>
            <Label className="font-medium text-fg">{label}</Label>
            {isIndeterminate ? null : <span className="text-fg-muted figures">{valueText}</span>}
          </span>
          <span className="relative block h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
            <span
              className={cx(
                'absolute inset-y-0 start-0 block rounded-full',
                TONE[tone],
                isIndeterminate && 'w-1/3 motion-safe:animate-pulse',
              )}
              style={isIndeterminate ? undefined : { width: `${percentage ?? 0}%` }}
            />
          </span>
        </>
      )}
    </AriaProgressBar>
  );
}
