/**
 * Decimal strings as text: validation, cleaning what people type, and display formatting, by string
 * manipulation only. No decimal.js here, so formatting (lib/i18n useFormat) does not pull the arithmetic library
 * into the first page load; lib/money adds the arithmetic and re-exports these.
 */
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
