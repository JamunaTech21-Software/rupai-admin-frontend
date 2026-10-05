import { type ReactNode, type Ref } from 'react';
import { Group, Input as AriaInput, TextField } from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { controlBox, type FieldProps, fieldWrapper, innerInput } from './fieldStyles';

export interface InputProps extends FieldProps {
  readonly value?: string | null | undefined;
  readonly onChange?: (value: string) => void;
  readonly type?: 'text' | 'email' | 'tel' | 'password' | 'url' | 'search';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly inputMode?: 'text' | 'email' | 'tel' | 'url' | 'search' | 'numeric' | 'decimal';
  readonly maxLength?: number;
  /** Shown inside the box before the text (an icon, a currency). Decorative: say it in the label too. */
  readonly startAdornment?: ReactNode;
  readonly endAdornment?: ReactNode;
  /** Text alignment inside the box; numbers are right-aligned. */
  readonly align?: 'start' | 'end';
  /** Called when the input gains focus. */
  readonly onFocus?: () => void;
}

/** A single-line text input. For money, quantities, numbers, dates and times use the domain inputs instead. */
export function Input({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  onFocus,
  inputRef,
  className,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  startAdornment,
  endAdornment,
  align = 'start',
}: InputProps) {
  return (
    <TextField
      value={value ?? ''}
      {...(onChange ? { onChange } : {})}
      {...(onBlur ? { onBlur } : {})}
      {...(onFocus ? { onFocus } : {})}
      {...(name ? { name } : {})}
      {...(autoComplete ? { autoComplete } : {})}
      {...(maxLength ? { maxLength } : {})}
      {...(inputMode ? { inputMode } : {})}
      type={type}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Group className={controlBox} isInvalid={Boolean(error)} isDisabled={isDisabled ?? false}>
        {startAdornment ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-fg-muted">
            {startAdornment}
          </span>
        ) : null}
        <AriaInput
          ref={inputRef as Ref<HTMLInputElement> | undefined}
          {...(placeholder ? { placeholder } : {})}
          className={cx(innerInput, align === 'end' && 'text-end figures')}
        />
        {endAdornment ? (
          <span aria-hidden="true" className="flex shrink-0 items-center text-fg-muted">
            {endAdornment}
          </span>
        ) : null}
      </Group>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
    </TextField>
  );
}
