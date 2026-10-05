import { type ReactNode, type Ref } from 'react';
import {
  CheckboxButton,
  CheckboxField,
  CheckboxGroup as AriaCheckboxGroup,
  RadioButton,
  RadioField,
  RadioGroup as AriaRadioGroup,
  SwitchButton,
  SwitchField,
} from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { type FieldProps, fieldWrapper } from './fieldStyles';
import { Icon } from './Icon';

/** The whole row (box + label) is the target: at least 44 px tall below md. */
const choiceRow = cx(
  'group flex cursor-default items-center gap-2 text-base text-fg',
  'min-h-(--size-touch-target) md:min-h-0 md:py-1',
  'data-disabled:cursor-not-allowed data-disabled:text-fg-subtle',
);

const box = cx(
  'flex size-5 shrink-0 items-center justify-center rounded-sm border-2 border-line-strong bg-surface text-fg-on-primary',
  'transition-colors duration-(--duration-fast)',
  'group-data-selected:border-primary group-data-selected:bg-primary',
  'group-data-indeterminate:border-primary group-data-indeterminate:bg-primary',
  'group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus',
  'group-data-invalid:border-danger',
  'group-data-disabled:opacity-50',
);

export interface CheckboxProps {
  /** The visible label; clicking it toggles the box. */
  readonly children: ReactNode;
  readonly isSelected?: boolean | undefined;
  readonly onChange?: (isSelected: boolean) => void;
  /** "Some but not all": a select-all box over a partly selected list. Shown as a dash. */
  readonly isIndeterminate?: boolean;
  readonly isDisabled?: boolean | undefined;
  readonly isInvalid?: boolean;
  /** The value when used inside a CheckboxGroup. */
  readonly value?: string;
  readonly name?: string;
  readonly onBlur?: () => void;
  readonly inputRef?: Ref<HTMLElement>;
  readonly className?: string;
}

/** A single yes/no choice, or one option in a CheckboxGroup. Space toggles it. */
export function Checkbox({
  children,
  isSelected,
  onChange,
  isIndeterminate = false,
  isDisabled,
  isInvalid = false,
  value,
  name,
  onBlur,
  inputRef,
  className,
}: CheckboxProps) {
  return (
    <CheckboxField
      {...(isSelected !== undefined ? { isSelected } : {})}
      {...(onChange ? { onChange } : {})}
      {...(value ? { value } : {})}
      {...(name ? { name } : {})}
      {...(onBlur ? { onBlur } : {})}
      {...(inputRef ? { inputRef: inputRef as Ref<HTMLInputElement> } : {})}
      isIndeterminate={isIndeterminate}
      isDisabled={isDisabled ?? false}
      isInvalid={isInvalid}
      {...(className ? { className } : {})}
    >
      <CheckboxButton className={choiceRow}>
        {({ isSelected: checked, isIndeterminate: partial }) => (
          <>
            <span className={box}>
              {partial ? (
                <span className="h-0.5 w-2.5 rounded-full bg-current" />
              ) : checked ? (
                <Icon name="check" size="sm" />
              ) : null}
            </span>
            <span>{children}</span>
          </>
        )}
      </CheckboxButton>
    </CheckboxField>
  );
}

export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly isDisabled?: boolean;
}

export interface CheckboxGroupProps extends FieldProps {
  readonly options: readonly ChoiceOption[];
  readonly value?: readonly string[] | undefined;
  readonly onChange?: (value: string[]) => void;
  readonly orientation?: 'vertical' | 'horizontal';
}

/** Several independent choices under one label (a group with its own name and error). */
export function CheckboxGroup({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  isReadOnly,
  name,
  onBlur,
  className,
  options,
  value = [],
  onChange,
  orientation = 'vertical',
}: CheckboxGroupProps) {
  return (
    <AriaCheckboxGroup
      value={[...value]}
      {...(onChange ? { onChange } : {})}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div className={cx('flex', orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-x-6')}>
        {options.map((option) => (
          <Checkbox key={option.id} value={option.id} isDisabled={option.isDisabled ?? false}>
            {option.label}
          </Checkbox>
        ))}
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
    </AriaCheckboxGroup>
  );
}

export interface RadioGroupProps extends FieldProps {
  readonly options: readonly ChoiceOption[];
  readonly value?: string | null | undefined;
  readonly onChange?: (value: string) => void;
  readonly orientation?: 'vertical' | 'horizontal';
}

/**
 * One choice from a few (up to ~5) options that should all be visible. Arrow keys move between options. For
 * longer lists use Select.
 */
export function RadioGroup({
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
  options,
  value,
  onChange,
  orientation = 'vertical',
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      value={value ?? null}
      {...(onChange ? { onChange } : {})}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      orientation={orientation}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isReadOnly={isReadOnly ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <div className={cx('flex', orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-x-6')}>
        {options.map((option, index) => (
          <RadioField
            key={option.id}
            value={option.id}
            isDisabled={option.isDisabled ?? false}
            {...(index === 0 && inputRef ? { inputRef: inputRef as Ref<HTMLInputElement> } : {})}
          >
            <RadioButton className={choiceRow}>
              <span
                className={cx(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface',
                  'group-data-selected:border-primary',
                  'group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus',
                  'group-data-disabled:opacity-50 group-data-invalid:border-danger',
                )}
              >
                <span className="size-2.5 scale-0 rounded-full bg-primary transition-transform duration-(--duration-fast) group-data-selected:scale-100" />
              </span>
              <span>{option.label}</span>
            </RadioButton>
          </RadioField>
        ))}
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
    </AriaRadioGroup>
  );
}

export interface SwitchProps {
  /** What is turned on or off ("Send SMS on approval"). */
  readonly children: ReactNode;
  readonly isSelected?: boolean | undefined;
  readonly onChange?: (isSelected: boolean) => void;
  readonly isDisabled?: boolean | undefined;
  readonly name?: string;
  readonly onBlur?: () => void;
  readonly inputRef?: Ref<HTMLElement>;
  readonly className?: string;
}

/**
 * A setting that takes effect immediately (on/off). For a choice that is saved with a form, use Checkbox.
 */
export function Switch({
  children,
  isSelected,
  onChange,
  isDisabled,
  name,
  onBlur,
  inputRef,
  className,
}: SwitchProps) {
  return (
    <SwitchField
      {...(isSelected !== undefined ? { isSelected } : {})}
      {...(onChange ? { onChange } : {})}
      {...(name ? { name } : {})}
      {...(onBlur ? { onBlur } : {})}
      {...(inputRef ? { inputRef: inputRef as Ref<HTMLInputElement> } : {})}
      isDisabled={isDisabled ?? false}
      {...(className ? { className } : {})}
    >
      <SwitchButton className={choiceRow}>
        <span
          className={cx(
            'flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-line-strong bg-surface-subtle p-0.5',
            'transition-colors duration-(--duration-fast)',
            'group-data-selected:border-primary group-data-selected:bg-primary',
            'group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus',
            'group-data-disabled:opacity-50',
          )}
        >
          <span className="size-4 rounded-full bg-line-strong shadow-sm transition-transform duration-(--duration-fast) group-data-selected:translate-x-4 group-data-selected:bg-surface" />
        </span>
        <span>{children}</span>
      </SwitchButton>
    </SwitchField>
  );
}
