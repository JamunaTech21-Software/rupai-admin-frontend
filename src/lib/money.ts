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

const COMPLETE = /^-?\d+(\.\d+)?$/;

/** A complete decimal string: optional minus, digits, optional fraction. No exponents, no separators. */
export function isDecimalString(value: string): boolean {
  return COMPLETE.test(value);
}

export interface DecimalInputRules {
  /** Most digits allowed after the point. */
  readonly scale: number;
  /** Most digits allowed before the point. */
  readonly intDigits: number;
  readonly allowNegative: boolean;
}

/**
 * Cleans what the user typed into a partial decimal ("1,234.5" → "1234.5", "12." stays "12."). Returns null
 * when the text cannot become a valid value under the rules, so the input can refuse the keystroke.
 */
export function sanitizeDecimalInput(raw: string, rules: DecimalInputRules): string | null {
  const text = raw.replace(/[,\s_]/g, '');
  const partial = rules.allowNegative ? /^-?\d*(\.\d*)?$/ : /^\d*(\.\d*)?$/;
  if (!partial.test(text)) return null;
  const [intPart = '', frac] = text.replace('-', '').split('.');
  if (frac !== undefined && frac.length > rules.scale) return null;
  if (intPart.replace(/^0+(?=\d)/, '').length > rules.intDigits) return null;
  return text;
}

/**
 * The value a partial input stands for: "" and "-" are no value, a trailing point is dropped, a leading point
 * gets a zero, and redundant leading zeros go. Fraction digits are kept exactly as typed ("1.50" stays "1.50").
 */
export function canonicalDecimal(draft: string): string | null {
  if (draft === '' || draft === '-' || draft === '.' || draft === '-.') return null;
  const negative = draft.startsWith('-');
  const [rawInt = '', frac] = draft.replace('-', '').split('.');
  const intPart = rawInt.replace(/^0+(?=\d)/, '') || '0';
  const body = frac === undefined || frac === '' ? intPart : `${intPart}.${frac}`;
  const isZero = /^0(\.0*)?$/.test(body);
  return negative && !isZero ? `-${body}` : body;
}

export type Grouping = 'international' | 'south-asian';

function groupInteger(digits: string, grouping: Grouping): string {
  if (grouping === 'international' || digits.length <= 3) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  // South Asian (lakh/crore) grouping: the last three digits, then pairs: 1,23,45,678.
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export interface FormatDecimalOptions {
  /** Places always shown (padding with zeros). Places beyond it are shown only when they are not zero. */
  readonly minScale?: number;
  readonly grouping?: Grouping;
}

/**
 * Formats a decimal string for display with thousands separators, by string manipulation only. It never
 * hides a significant digit: "12345.6700" → "12,345.67", "12345.6789" → "12,345.6789", "5" → "5.00".
 */
export function formatDecimal(value: string, options: FormatDecimalOptions = {}): string {
  const { minScale = 2, grouping = 'international' } = options;
  if (!isDecimalString(value)) return value;
  const negative = value.startsWith('-');
  const [intPart = '0', frac = ''] = value.replace('-', '').split('.');
  const significant = frac.replace(/0+$/, '');
  const shown = significant.length >= minScale ? significant : significant.padEnd(minScale, '0');
  const body = groupInteger(intPart.replace(/^0+(?=\d)/, ''), grouping) + (shown ? `.${shown}` : '');
  return negative ? `-${body}` : body;
}

/** The API form of a value: a fixed number of places for the kind, e.g. money "12345.6700", qty "2400.000". */
export function toApiDecimal(value: string, kind: DecimalKind): string {
  return new Dec(value).toFixed(DECIMAL_KINDS[kind].scale, Decimal.ROUND_HALF_UP);
}

/** Payable money is rounded to 2 places, half up (Spec P9 §2.2): 3040.625 → "3040.63". */
export function roundMoney(value: string): string {
  return new Dec(value).toFixed(2, Decimal.ROUND_HALF_UP);
}
