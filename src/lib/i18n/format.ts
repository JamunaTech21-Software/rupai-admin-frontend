import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { APP_TIMEZONE, toCalendarDate } from '../dates';
import { formatDecimal } from '../decimalText';

/**
 * Locale-aware formatting through one set of shared utilities (Spec P5 §14). Screens never call Intl or
 * toLocaleString themselves; they ask useFormat().
 *
 * | language | digits  | grouping                     | example            |
 * | -------- | ------- | ---------------------------- | ------------------ |
 * | en       | 0–9     | international (3,3,3)        | ৳1,234,567.50      |
 * | bn       | ০–৯     | South Asian, lakh/crore      | ৳১২,৩৪,৫৬৭.৫০      |
 *
 * Money and quantities stay decimal strings: they are formatted by string manipulation (lib/money), never via
 * a float, then given local digits.
 */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toLocalDigits(text: string, language: string): string {
  if (language !== 'bn') return text;
  return text.replace(/[0-9]/g, (digit) => BN_DIGITS[Number.parseInt(digit, 10)] ?? digit);
}

export interface Formatters {
  readonly language: 'en' | 'bn';
  /** Intl locale for numbers and dates. */
  readonly locale: string;
  /** A count or plain number: 1,240 / ১,২৪০. */
  readonly number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** A decimal string with grouping, keeping every significant digit: "12345.6700" → 12,345.67. */
  readonly decimal: (value: string, minScale?: number) => string;
  /** Money in taka: "12345.6" → ৳12,345.60. */
  readonly money: (value: string) => string;
  /** A quantity in kg to the gram: "41.25" → 41.250 kg. */
  readonly quantity: (value: string, unit?: string) => string;
  /** A business date "2026-10-04" → 4 Oct 2026 / ৪ অক্টো, ২০২৬. No timezone drift. */
  readonly date: (value: string) => string;
  /** An API timestamp in the estate's timezone → 4 Oct 2026, 14:05. */
  readonly dateTime: (iso: string) => string;
}

export function makeFormatters(language: string): Formatters {
  const lang = language === 'bn' ? 'bn' : 'en';
  const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
  const grouping = lang === 'bn' ? 'south-asian' : 'international';
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const dateTimeFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: APP_TIMEZONE,
  });
  const decimal = (value: string, minScale = 2) =>
    toLocalDigits(formatDecimal(value, { minScale, grouping }), lang);

  return {
    language: lang,
    locale,
    number: (value, options) =>
      new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', options).format(value),
    decimal,
    money: (value) => (value.startsWith('-') ? `-৳${decimal(value.slice(1), 2)}` : `৳${decimal(value, 2)}`),
    quantity: (value, unit = 'kg') => `${decimal(value, 3)} ${unit}`,
    date: (value) => {
      const date = toCalendarDate(value);
      return date ? dateFormat.format(date.toDate('UTC')) : value;
    },
    dateTime: (iso) => {
      const instant = new Date(iso);
      return Number.isNaN(instant.getTime()) ? iso : dateTimeFormat.format(instant);
    },
  };
}

/** The formatters for the active language, updated when it changes. */
export function useFormat(): Formatters {
  const { i18n } = useTranslation();
  return useMemo(() => makeFormatters(i18n.language), [i18n.language]);
}
