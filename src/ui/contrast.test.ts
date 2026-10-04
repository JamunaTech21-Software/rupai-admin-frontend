import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('is symmetric and accepts the short hex form', () => {
    expect(contrastRatio('#fff', '#1b5e4b')).toBeCloseTo(contrastRatio('#1b5e4b', '#ffffff'), 10);
  });

  it('refuses a value that is not a hex colour', () => {
    expect(() => contrastRatio('rgb(0 0 0)', '#fff')).toThrow(/Not a hex colour/);
  });
});
