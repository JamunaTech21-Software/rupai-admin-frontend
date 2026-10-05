import { type ReactNode, useId } from 'react';
import { FieldError, Label, Text } from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';

interface FieldLabelProps {
  readonly children: ReactNode;
  readonly isRequired?: boolean | undefined;
  readonly hidden?: boolean | undefined;
}

/**
 * A control's label. Inside a React Aria field it is wired automatically. The required marker is visual only;
 * the control itself carries `aria-required`, so screen readers say "required" once.
 */
export function FieldLabel({ children, isRequired, hidden }: FieldLabelProps) {
  return (
    <Label className={cx('text-sm font-medium text-fg', hidden && 'sr-only')}>
      {children}
      {isRequired ? (
        <span aria-hidden="true" className="ms-0.5 text-danger">
          *
        </span>
      ) : null}
    </Label>
  );
}

/** Help under a control, linked with aria-describedby. */
export function FieldHint({ children }: { readonly children: ReactNode }) {
  return (
    <Text slot="description" className="text-sm text-fg-muted">
      {children}
    </Text>
  );
}

/** The error under a control. Shown only while the field is invalid; linked with aria-describedby. */
export function FieldErrorText({ children }: { readonly children: ReactNode }) {
  return (
    <FieldError className="flex items-start gap-1 text-sm text-danger">
      <Icon name="error" size="sm" className="mt-0.5" />
      <span>{children}</span>
    </FieldError>
  );
}

/** The ARIA attributes FormField hands to a custom control. */
export interface FormFieldAria {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': true | undefined;
  readonly 'aria-required': true | undefined;
}

export interface FormFieldProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly isRequired?: boolean | undefined;
  readonly hideLabel?: boolean | undefined;
  /** Render the control with the ARIA attributes that tie it to the label, hint and error. */
  readonly children: (aria: FormFieldAria) => ReactNode;
  readonly className?: string | undefined;
}

/**
 * The field wrapper for a control that is not a React Aria field (a custom widget, a third-party input): label,
 * required marker, hint and error, all wired with ARIA. The ui controls wire this themselves; use FormField
 * only for something custom.
 */
export function FormField({
  label,
  hint,
  error,
  isRequired,
  hideLabel,
  children,
  className,
}: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className={cx('text-sm font-medium text-fg', hideLabel && 'sr-only')}>
        {label}
        {isRequired ? (
          <span aria-hidden="true" className="ms-0.5 text-danger">
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': isRequired ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-sm text-danger">
          <Icon name="error" size="sm" className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
