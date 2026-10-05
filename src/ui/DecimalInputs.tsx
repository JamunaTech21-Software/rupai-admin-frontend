import { useState } from 'react';

import {
  canonicalDecimal,
  DECIMAL_KINDS,
  type DecimalKind,
  formatDecimal,
  type Grouping,
  sanitizeDecimalInput,
} from '@/lib/money';

import { Input } from './Input';
import { type FieldProps } from './fieldStyles';
import { useUiText } from './uiText';

interface DecimalFieldProps extends FieldProps {
  /** A decimal string ("12345.6700") or null. Never a number. */
  readonly value?: string | null | undefined;
  /** Called with the canonical decimal string as typed, or null when empty. */
  readonly onChange?: (value: string | null) => void;
  readonly placeholder?: string;
  readonly allowNegative?: boolean;
  readonly grouping?: Grouping;
}

interface DecimalFieldConfig {
  readonly kind: DecimalKind;
  readonly maxScale: number;
  readonly minDisplayScale: number;
  readonly prefix?: string | undefined;
  readonly suffix?: string | undefined;
  /** The unit for screen readers, read with the label ("Rate, in Taka"). */
  readonly unitLabel: string;
}

/**
 * The shared core of MoneyInput and QuantityInput. While focused it shows the raw value for editing; on blur it
 * shows thousands separators. Keystrokes that would make an invalid number (letters, a second point, too many
 * places) are refused. The value is only ever a string: decimal.js does any arithmetic, never a float.
 */
function DecimalField({
  value,
  onChange,
  onBlur,
  allowNegative = false,
  grouping = 'international',
  config,
  label,
  ...rest
}: DecimalFieldProps & { readonly config: DecimalFieldConfig }) {
  const text = useUiText();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const rules = { scale: config.maxScale, intDigits: DECIMAL_KINDS[config.kind].intDigits, allowNegative };

  const display = focused
    ? draft
    : value
      ? formatDecimal(value, { minScale: config.minDisplayScale, grouping })
      : '';

  return (
    <Input
      {...rest}
      label={label}
      value={display}
      inputMode="decimal"
      align="end"
      autoComplete="off"
      startAdornment={config.prefix}
      endAdornment={config.suffix}
      hint={rest.hint ?? text.inUnit(config.unitLabel)}
      onFocus={() => {
        setDraft(value ?? '');
        setFocused(true);
      }}
      onChange={(text) => {
        const clean = sanitizeDecimalInput(text, rules);
        if (clean === null) return; // refuse the keystroke: the input keeps its previous text
        setDraft(clean);
        onChange?.(canonicalDecimal(clean));
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
    />
  );
}

export interface MoneyInputProps extends DecimalFieldProps {
  /** Places a person may type. Defaults to 2; use 4 for unit rates (the money kind stores 4). */
  readonly scale?: 2 | 3 | 4;
  /** The currency symbol shown before the amount. */
  readonly currencySymbol?: string;
  /** The currency's name for the hint and screen readers. */
  readonly currencyName?: string;
}

/**
 * A money amount as a decimal string. "12345.6700" in comes out unchanged unless edited, and shows as
 * "12,345.67". Never swap it for a generic number input: floats corrupt money.
 */
export function MoneyInput({ scale = 2, currencySymbol = '৳', currencyName, ...props }: MoneyInputProps) {
  const text = useUiText();
  return (
    <DecimalField
      {...props}
      config={{
        kind: 'money',
        maxScale: scale,
        minDisplayScale: 2,
        prefix: currencySymbol,
        unitLabel: currencyName ?? text.currencyName,
      }}
    />
  );
}

export interface QuantityInputProps extends DecimalFieldProps {
  /** The unit shown after the value. Quantities are stored in kg. */
  readonly unit?: string;
  readonly unitName?: string;
}

/** A quantity or weight to the gram: 3 decimal places, shown with its unit ("1,250.500 kg"). */
export function QuantityInput({ unit = 'kg', unitName, ...props }: QuantityInputProps) {
  const text = useUiText();
  return (
    <DecimalField
      {...props}
      config={{
        kind: 'qty',
        maxScale: 3,
        minDisplayScale: 3,
        suffix: unit,
        unitLabel: unitName ?? text.kilograms,
      }}
    />
  );
}
