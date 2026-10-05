import { type Ref, useState } from 'react';
import { TextArea, TextField } from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { type FieldProps, fieldWrapper } from './fieldStyles';
import { useUiText } from './uiText';

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
  const text = useUiText();
  // Uncontrolled (no value given): count what is typed for the "n of max" counter.
  const [typedLength, setTypedLength] = useState(0);
  const length = value !== undefined ? (value ?? '').length : typedLength;
  return (
    <TextField
      {...(value !== undefined ? { value: value ?? '' } : {})}
      onChange={(typed) => {
        setTypedLength(typed.length);
        onChange?.(typed);
      }}
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
              {text.characterCount(String(length), String(maxLength))}
            </span>
          ) : null}
        </div>
      ) : null}
      <FieldErrorText>{error}</FieldErrorText>
    </TextField>
  );
}
