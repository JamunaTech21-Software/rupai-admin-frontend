import { cx } from './cx';
import { Icon } from './Icon';
import { type IconName } from './iconSet';
import { type DocumentState, type FeedbackRole } from './tokens';

export type BadgeTone = DocumentState | FeedbackRole | 'neutral';

const TONE: Record<BadgeTone, string> = {
  draft: 'text-state-draft bg-state-draft-subtle border-state-draft',
  submitted: 'text-state-submitted bg-state-submitted-subtle border-state-submitted',
  approved: 'text-state-approved bg-state-approved-subtle border-state-approved',
  posted: 'text-state-posted bg-state-posted-subtle border-state-posted',
  rejected: 'text-state-rejected bg-state-rejected-subtle border-state-rejected',
  cancelled: 'text-state-cancelled bg-state-cancelled-subtle border-state-cancelled',
  success: 'text-success bg-success-subtle border-success',
  warning: 'text-warning bg-warning-subtle border-warning',
  danger: 'text-danger bg-danger-subtle border-danger',
  info: 'text-info bg-info-subtle border-info',
  neutral: 'text-fg-muted bg-surface-subtle border-line-strong',
};

/** Every state also has its own shape, so states differ by more than colour. */
const TONE_ICON: Partial<Record<BadgeTone, IconName>> = {
  draft: 'draft',
  submitted: 'send',
  approved: 'checkCircle',
  posted: 'posted',
  rejected: 'error',
  cancelled: 'ban',
  success: 'checkCircle',
  warning: 'alert',
  danger: 'error',
  info: 'info',
};

export interface BadgeProps {
  readonly tone: BadgeTone;
  /** Required visible text: the state's name ("Approved") or the status it reports. Colour never stands alone. */
  readonly label: string;
  /** Hide the shape icon where space is very tight (dense tables). The label still carries the meaning. */
  readonly hideIcon?: boolean;
  readonly className?: string;
}

/**
 * A read-only status: a document state (draft … cancelled) or a feedback status. It is not interactive; for a
 * removable or selectable chip use Tag.
 */
export function Badge({ tone, label, hideIcon = false, className }: BadgeProps) {
  const icon = TONE_ICON[tone];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-sm font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {icon && !hideIcon ? <Icon name={icon} size="sm" /> : null}
      {label}
    </span>
  );
}
