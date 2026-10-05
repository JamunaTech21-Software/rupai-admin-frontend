import { useState } from 'react';

import { announce } from './announce';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { useUiText } from './uiText';

export interface ErrorStateProps {
  /** What failed, in the user's terms: "The muster could not be loaded." */
  readonly title?: string;
  /** What to do about it: "Check your connection and try again." */
  readonly message?: string;
  /**
   * The backend's `request_id` from the error envelope. Shown so the user can quote it to support, who can find
   * the exact request in the logs.
   */
  readonly requestId?: string | null | undefined;
  /** Shows "Try again". Leave out when retrying cannot help (no permission, not found). */
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
  /** `page` fills the content area; `inline` sits inside a card or table. */
  readonly size?: 'page' | 'inline';
  readonly className?: string;
}

/**
 * The error state of a region whose data could not load (one of the five interface states, Spec P5 §8). It
 * replaces the content, says what failed, offers a retry and carries the request id for support.
 */
export function ErrorState({
  title,
  message,
  requestId,
  onRetry,
  isRetrying = false,
  size = 'inline',
  className,
}: ErrorStateProps) {
  const text = useUiText();
  const [copied, setCopied] = useState(false);

  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col items-center gap-3 text-center',
        size === 'page' ? 'px-4 py-16' : 'px-4 py-8',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <Icon name="error" size="lg" />
      </span>
      <h2 className={cx('font-semibold text-fg', size === 'page' ? 'text-xl' : 'text-lg')}>
        {title ?? text.errorTitle}
      </h2>
      <p className="max-w-prose text-fg-muted">{message ?? text.errorMessage}</p>
      {requestId ? (
        <p className="flex items-center gap-1 text-sm text-fg-muted">
          {text.reference} <code className="font-mono text-fg">{requestId}</code>
          <IconButton
            icon={copied ? 'check' : 'copy'}
            label={text.copyReference}
            variant="ghost"
            size="sm"
            onPress={() => {
              void navigator.clipboard.writeText(requestId).then(() => {
                setCopied(true);
                announce(text.referenceCopied);
              });
            }}
          />
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" iconStart="refresh" isPending={isRetrying} onPress={onRetry}>
          {text.tryAgain}
        </Button>
      ) : null}
    </div>
  );
}
