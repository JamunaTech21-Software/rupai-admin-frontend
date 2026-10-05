import Decimal from 'decimal.js';

/**
 * Money and quantities as decimal strings (Spec P9 §2.1, P4 §2.3). Values travel and are stored as strings
 * such as "12345.6700"; arithmetic uses decimal.js. A JavaScript number never touches money or quantity.
 */

/** Mirrors the backend's DECIMAL_KINDS (backend/src/core/money/decimal.ts): scale and integer digits per kind. */
export const DECIMAL_KINDS = {
  /** Money, DECIMAL(18,4). Payable amounts are rounded to 2 places. */
  money: { scale: 4, intDigits: 14 },
  /** Quantity and weight in kg, DECIMAL(14,3): to the gram. */
  qty: { scale: 3, intDigits: 11 },
  /** Exchange rate, DECIMAL(18,8). */
  rate: { scale: 8, intDigits: 10 },
  /** Percentage, ratio or yield, DECIMAL(9,4). */
  pct: { scale: 4, intDigits: 5 },
} as const;
export type DecimalKind = keyof typeof DECIMAL_KINDS;

/** The decimal type: 40 significant digits, half-up rounding, matching the backend. */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export {
  canonicalDecimal,
  type DecimalInputRules,
  formatDecimal,
  type FormatDecimalOptions,
  type Grouping,
  isDecimalString,
  sanitizeDecimalInput,
} from './decimalText';

/** The API form of a value: a fixed number of places for the kind, e.g. money "12345.6700", qty "2400.000". */
export function toApiDecimal(value: string, kind: DecimalKind): string {
  return new Dec(value).toFixed(DECIMAL_KINDS[kind].scale, Decimal.ROUND_HALF_UP);
}

/** Payable money is rounded to 2 places, half up (Spec P9 §2.2): 3040.625 → "3040.63". */
export function roundMoney(value: string): string {
  return new Dec(value).toFixed(2, Decimal.ROUND_HALF_UP);
}
