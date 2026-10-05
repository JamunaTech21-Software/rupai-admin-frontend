import { Button as AriaButton } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';

export interface TagProps {
  /** The visible text, e.g. a division name in a filter bar. */
  readonly label: string;
  /** Shows a remove button named "Remove {label}". */
  readonly onRemove?: () => void;
  readonly isDisabled?: boolean;
  readonly className?: string;
}

/**
 * A neutral chip for a category, an applied filter or a selected value. It never carries a status (use Badge).
 * With `onRemove`, its remove button is keyboard operable and named after the tag.
 */
export function Tag({ label, onRemove, isDisabled = false, className }: TagProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border py-0.5 text-sm',
        onRemove ? 'ps-3 pe-1' : 'px-3',
        // Still readable when disabled (5.3:1); the remove button carries the disabled state.
        isDisabled ? 'border-line bg-surface-subtle text-fg-subtle' : 'border-line-strong bg-surface text-fg',
        className,
      )}
    >
      {label}
      {onRemove ? (
        <AriaButton
          aria-label={`Remove ${label}`}
          onPress={onRemove}
          isDisabled={isDisabled}
          className={cx(
            'inline-flex items-center justify-center rounded-full text-fg-muted md:size-6',
            'data-hovered:bg-surface-subtle data-hovered:text-fg',
            'data-focus-visible:outline-2 data-focus-visible:outline-offset-1 data-focus-visible:outline-focus',
            'data-disabled:cursor-not-allowed',
          )}
        >
          <Icon name="close" size="sm" />
        </AriaButton>
      ) : null}
    </span>
  );
}
