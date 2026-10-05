import { type Ref } from 'react';
import { Button, Group, Input as AriaInput, NumberField } from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { controlBox, type FieldProps, fieldWrapper, innerInput } from './fieldStyles';
import { Icon } from './Icon';

export interface NumberInputProps extends FieldProps {
  readonly value?: number | null | undefined;
  readonly onChange?: (value: number | null) => void;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly step?: number;
  /** Intl number formatting, e.g. `{ maximumFractionDigits: 0 }` for whole numbers. */
  readonly formatOptions?: Intl.NumberFormatOptions;
}

/**
 * A count or other plain number (workers in a gang, days, a percentage shown as a whole number), with step
 * buttons and arrow keys. Not for money or quantities: those are decimal strings (MoneyInput, QuantityInput).
 */
export function NumberInput({
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
  minValue,
  maxValue,
  step = 1,
  formatOptions = { maximumFractionDigits: 0 },
}: NumberInputProps) {
  return (
    <NumberField
      // Controlled only when given a value (null = empty, which React Aria spells NaN).
      {...(value !== undefined ? { value: value ?? Number.NaN } : {})}
      onChange={(next) => onChange?.(Number.isNaN(next) ? null : next)}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      {...(minValue !== undefined ? { minValue } : {})}
      {...(maxValue !== undefined ? { maxValue } : {})}
      step={step}
      formatOptions={formatOptions}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Group className={cx(controlBox, 'pe-1')} isInvalid={Boolean(error)} isDisabled={isDisabled ?? false}>
        <AriaInput
          ref={inputRef as Ref<HTMLInputElement> | undefined}
          className={cx(innerInput, 'text-end figures')}
        />
        <span className="flex shrink-0 gap-0.5">
          <Button
            slot="decrement"
            className="flex size-8 items-center justify-center rounded-sm text-fg-muted data-disabled:opacity-50 data-hovered:bg-surface-subtle"
          >
            <Icon name="chevronDown" size="sm" />
          </Button>
          <Button
            slot="increment"
            className="flex size-8 items-center justify-center rounded-sm text-fg-muted data-disabled:opacity-50 data-hovered:bg-surface-subtle"
          >
            <Icon name="chevronUp" size="sm" />
          </Button>
        </span>
      </Group>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
    </NumberField>
  );
}
