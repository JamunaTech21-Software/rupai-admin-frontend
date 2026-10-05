import { type ReactNode, useState } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { type IconName } from './iconSet';
import { type FeedbackRole } from './tokens';
import { useUiText } from './uiText';

const TONE: Record<FeedbackRole, { icon: IconName; className: string }> = {
  info: { icon: 'info', className: 'border-info bg-info-subtle [&>svg]:text-info' },
  success: { icon: 'checkCircle', className: 'border-success bg-success-subtle [&>svg]:text-success' },
  warning: { icon: 'alert', className: 'border-warning bg-warning-subtle [&>svg]:text-warning' },
  danger: { icon: 'error', className: 'border-danger bg-danger-subtle [&>svg]:text-danger' },
};

export interface AlertProps {
  readonly tone: FeedbackRole;
  /** A short summary in bold: "This period is closed." */
  readonly title?: string;
  readonly children?: ReactNode;
  /** A button or link that resolves it: "Reopen period". */
  readonly action?: ReactNode;
  /** Shows a close button. Leave out for anything the user must not miss (a closed period, a form error). */
  readonly onDismiss?: () => void;
  /**
   * Announce it when it appears. On by default for danger: an error shown after an action is read out at once.
   * Leave off for an alert that is part of the page from the start.
   */
  readonly announce?: boolean;
  readonly className?: string;
}

/**
 * A message inside the page that stays until dealt with (Spec P5 §6.4): a form error from the server, a
 * warning about a closed period, a note about the data shown. Unlike a toast it never disappears by itself, so
 * it is the place for errors. Tone is carried by the icon and the title, not by colour alone.
 */
export function Alert({
  tone,
  title,
  children,
  action,
  onDismiss,
  announce = tone === 'danger',
  className,
}: AlertProps) {
  const text = useUiText();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      {...(announce ? { role: tone === 'danger' ? 'alert' : 'status' } : {})}
      className={cx('flex items-start gap-3 rounded-md border p-3 text-fg', TONE[tone].className, className)}
    >
      <Icon name={TONE[tone].icon} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-sm">{children}</div> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
      {onDismiss ? (
        <IconButton
          icon="close"
          label={text.dismiss}
          variant="ghost"
          size="sm"
          onPress={() => {
            setDismissed(true);
            onDismiss();
          }}
        />
      ) : null}
    </div>
  );
}
