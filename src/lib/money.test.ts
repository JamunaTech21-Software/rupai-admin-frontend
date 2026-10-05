import { describe, expect, it } from 'vitest';

import {
  canonicalDecimal,
  Dec,
  formatDecimal,
  isDecimalString,
  roundMoney,
  sanitizeDecimalInput,
  toApiDecimal,
} from './money';

const money2 = { scale: 2, intDigits: 14, allowNegative: false };

describe('isDecimalString', () => {
  it.each(['0', '12345.6700', '-3.5', '007'])('accepts %s', (value) => {
    expect(isDecimalString(value)).toBe(true);
  });

  it.each(['', '1e5', '1,234', '12.', '.5', 'NaN', ' 1'])('refuses %j', (value) => {
    expect(isDecimalString(value)).toBe(false);
  });
});

describe('sanitizeDecimalInput', () => {
  it('strips separators people type or paste', () => {
    expect(sanitizeDecimalInput('1,234.5', money2)).toBe('1234.5');
    expect(sanitizeDecimalInput('1 234_000', money2)).toBe('1234000');
  });

  it('keeps partial values while typing', () => {
    expect(sanitizeDecimalInput('12.', money2)).toBe('12.');
    expect(sanitizeDecimalInput('', money2)).toBe('');
  });

  it('refuses letters, a second point, too many places and too many digits', () => {
    expect(sanitizeDecimalInput('12a', money2)).toBeNull();
    expect(sanitizeDecimalInput('1.2.3', money2)).toBeNull();
    expect(sanitizeDecimalInput('1.234', money2)).toBeNull();
    expect(sanitizeDecimalInput('123456789012345', money2)).toBeNull();
    expect(sanitizeDecimalInput('1e5', money2)).toBeNull();
  });

  it('allows a minus sign only when negatives are allowed', () => {
    expect(sanitizeDecimalInput('-5', money2)).toBeNull();
    expect(sanitizeDecimalInput('-5', { ...money2, allowNegative: true })).toBe('-5');
  });

  it('does not count leading zeros against the digit limit', () => {
    expect(sanitizeDecimalInput('00012', { scale: 0, intDigits: 2, allowNegative: false })).toBe('00012');
  });
});

describe('canonicalDecimal', () => {
  it('treats empty and lone signs as no value', () => {
    for (const draft of ['', '-', '.', '-.']) expect(canonicalDecimal(draft)).toBeNull();
  });

  it('tidies a partial value without changing its digits', () => {
    expect(canonicalDecimal('12.')).toBe('12');
    expect(canonicalDecimal('.5')).toBe('0.5');
    expect(canonicalDecimal('007.50')).toBe('7.50');
    expect(canonicalDecimal('-0.00')).toBe('0.00');
    expect(canonicalDecimal('-12.5')).toBe('-12.5');
  });
});

describe('formatDecimal', () => {
  it('adds thousands separators and never hides a significant digit', () => {
    expect(formatDecimal('12345.6700')).toBe('12,345.67');
    expect(formatDecimal('12345.6789')).toBe('12,345.6789');
    expect(formatDecimal('5')).toBe('5.00');
    expect(formatDecimal('-1234567.5')).toBe('-1,234,567.50');
    expect(formatDecimal('2400.000', { minScale: 3 })).toBe('2,400.000');
  });

  it('supports South Asian grouping', () => {
    expect(formatDecimal('1234567.5', { grouping: 'south-asian' })).toBe('12,34,567.50');
    expect(formatDecimal('123', { grouping: 'south-asian' })).toBe('123.00');
  });

  it('returns anything that is not a decimal string unchanged', () => {
    expect(formatDecimal('abc')).toBe('abc');
  });
});

describe('API values', () => {
  it('pads to the kind’s scale, exactly', () => {
    expect(toApiDecimal('12345.67', 'money')).toBe('12345.6700');
    expect(toApiDecimal('2400', 'qty')).toBe('2400.000');
    expect(toApiDecimal('0.1', 'rate')).toBe('0.10000000');
  });

  it('round-trips 12345.6700 exactly', () => {
    expect(toApiDecimal('12345.6700', 'money')).toBe('12345.6700');
    expect(canonicalDecimal('12345.6700')).toBe('12345.6700');
  });

  it('rounds payable money half up to 2 places', () => {
    expect(roundMoney('3040.625')).toBe('3040.63');
    expect(roundMoney('3040.624')).toBe('3040.62');
  });

  it('does decimal arithmetic without float error', () => {
    expect(new Dec('0.1').plus('0.2').toString()).toBe('0.3');
    expect(new Dec('8.2550').times('41.250').toFixed(4)).toBe('340.5188');
  });
});
