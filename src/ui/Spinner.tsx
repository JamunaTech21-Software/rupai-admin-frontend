import { cx } from './cx';
import { useUiText } from './uiText';

const SIZE = { sm: 'size-4', md: 'size-5', lg: 'size-8' } as const;

export interface SpinnerProps {
  readonly size?: keyof typeof SIZE;
  /**
   * Announced to screen readers as a status. Pass `null` when something else already announces the wait
   * (a pending Button announces itself), so the spinner is purely visual.
   */
  readonly label?: string | null;
  readonly className?: string;
}

/**
 * An indeterminate progress indicator. Under reduced motion it stops spinning and stays visible as a static
 * ring, so the wait is still communicated.
 */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const text = useUiText();
  const svg = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx(SIZE[size], 'shrink-0 animate-spin motion-reduce:animate-none', className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (label === null) return svg;
  return (
    <span role="status" className="inline-flex items-center">
      {svg}
      <span className="sr-only">{label ?? text.loading}</span>
    </span>
  );
}
