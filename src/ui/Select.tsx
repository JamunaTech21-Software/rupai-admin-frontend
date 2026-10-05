import { type Ref } from 'react';
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from 'react-aria-components';

import { cx } from './cx';
import { FieldErrorText, FieldHint, FieldLabel } from './Field';
import { type FieldProps, fieldWrapper, listItem, popover, triggerButton } from './fieldStyles';
import { Icon } from './Icon';

export interface SelectOption {
  readonly id: string;
  readonly label: string;
  /** A second line under the label (a code, a location). */
  readonly description?: string;
  readonly isDisabled?: boolean;
}

interface BaseSelectProps extends FieldProps {
  /** A short list known up front (under ~50). For searching many records use AsyncCombobox. */
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
}

function OptionList({ options }: { readonly options: readonly SelectOption[] }) {
  return (
    <Popover className={popover}>
      <ListBox items={options} className="outline-none">
        {(option) => (
          <ListBoxItem
            id={option.id}
            textValue={option.label}
            isDisabled={option.isDisabled ?? false}
            className={listItem}
          >
            {({ isSelected }) => (
              <>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  {option.description ? (
                    <span className="truncate text-sm text-fg-muted">{option.description}</span>
                  ) : null}
                </span>
                {isSelected ? <Icon name="check" size="sm" className="text-primary" /> : null}
              </>
            )}
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  );
}

export interface SelectProps extends BaseSelectProps {
  readonly value?: string | null | undefined;
  readonly onChange?: (value: string | null) => void;
}

/** Pick one option from a short list. Keyboard: Enter, Space or the arrow keys open it; type to jump. */
export function Select({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  name,
  onBlur,
  inputRef,
  className,
  options,
  value,
  onChange,
  placeholder = 'Choose…',
}: SelectProps) {
  return (
    <AriaSelect
      value={value ?? null}
      onChange={(key) => onChange?.(key === null ? null : String(key))}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      placeholder={placeholder}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Button ref={inputRef as Ref<HTMLButtonElement> | undefined} className={triggerButton}>
        <SelectValue className="truncate data-placeholder:text-fg-subtle" />
        <Icon name="chevronDown" size="sm" className="text-fg-muted" />
      </Button>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
      <OptionList options={options} />
    </AriaSelect>
  );
}

export interface MultiSelectProps extends BaseSelectProps {
  readonly value?: readonly string[] | undefined;
  readonly onChange?: (value: string[]) => void;
}

/**
 * Pick several options from a short list. The list stays open while choosing; the button summarises the
 * choice ("Division 1, Division 3" or "4 selected").
 */
export function MultiSelect({
  label,
  hideLabel,
  hint,
  error,
  isRequired,
  isDisabled,
  name,
  onBlur,
  inputRef,
  className,
  options,
  value = [],
  onChange,
  placeholder = 'Choose…',
}: MultiSelectProps) {
  const labels = options.filter((option) => value.includes(option.id)).map((option) => option.label);
  const summary = labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;

  return (
    <AriaSelect
      selectionMode="multiple"
      value={value}
      onChange={(keys) => onChange?.(keys.map(String))}
      {...(onBlur ? { onBlur } : {})}
      {...(name ? { name } : {})}
      placeholder={placeholder}
      isRequired={isRequired ?? false}
      isDisabled={isDisabled ?? false}
      isInvalid={Boolean(error)}
      className={cx(fieldWrapper, className)}
    >
      <FieldLabel isRequired={isRequired} hidden={hideLabel}>
        {label}
      </FieldLabel>
      <Button ref={inputRef as Ref<HTMLButtonElement> | undefined} className={triggerButton}>
        <SelectValue className="truncate data-placeholder:text-fg-subtle">
          {({ isPlaceholder }) => (isPlaceholder ? placeholder : summary)}
        </SelectValue>
        <Icon name="chevronDown" size="sm" className="text-fg-muted" />
      </Button>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <FieldErrorText>{error}</FieldErrorText>
      <OptionList options={options} />
    </AriaSelect>
  );
}
