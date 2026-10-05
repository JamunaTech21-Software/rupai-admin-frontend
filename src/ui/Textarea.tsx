import { type Ref } from 'react';
import { TextArea, TextField } from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { type FieldProps, fieldWrapper } from './fieldStyles';

export interface TextareaProps extends FieldProps {
  readonly value?: string | null | undefined;
  readonly onChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly rows?: number;
  /** Shows "n of max characters" under the box and stops at max. */
  readonly maxLength?: number;
}

/** Multi-line text: remarks, reasons, addresses. */
export function Textarea({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  inputRef,
  className,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
}: TextareaProps) {
  const length = (value ?? '').length;
  return (
    <TextField
      value={value ?? ''}
      {...(onChange ? { onChange } : {})}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      {...(maxLength ? { maxLength } : {})}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <TextArea
        ref={inputRef as Ref<HTMLTextAreaElement> | undefined}
        rows={rows}
        {...(placeholder ? { placeholder } : {})}
        className={cx(
          'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-subtle',
          'data-hovered:border-fg-muted',
          'data-focused:outline-2 data-focused:outline-offset-1 data-focused:outline-focus',
          'data-invalid:border-danger',
          'data-disabled:cursor-not-allowed data-disabled:bg-surface-subtle data-disabled:text-fg-subtle',
        )}
      />
      {hint || maxLength ? (
        <div className="flex justify-between gap-3">
          {hint ? <FieldHint>{hint}</FieldHint> : <span />}
          {maxLength ? (
            <span className="shrink-0 text-sm text-fg-muted figures">
              {length} of {maxLength}
            </span>
          ) : null}
        </div>
      ) : null}
      <FieldErrorText>{error}</FieldErrorText>
    </TextField>
  );
}
