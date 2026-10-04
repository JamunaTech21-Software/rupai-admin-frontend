import { describe, expect, it } from 'vitest';

/**
 * Colours are named by role, never appearance (F0.02). Tailwind's default palette is switched off, so a class
 * like `bg-slate-50` would silently produce no CSS: this test catches it, and catches hard-coded colours.
 */
const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const UTILITIES = 'bg|text|border|divide|ring|outline|fill|stroke|from|via|to|shadow|accent|caret|decoration';
const APPEARANCE_CLASS = new RegExp(String.raw`\b(?:${UTILITIES})-(?:${PALETTE})(?:-\d{2,3})?\b`);
const HARD_CODED = /-\[(?:#|rgb|hsl|oklch)/;

describe('role-named colours', () => {
  it('finds source files to check', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5);
  });

  it('recognises appearance-named classes and hard-coded colours', () => {
    for (const bad of ['bg-slate-50', 'text-green-700', 'border-white', 'divide-gray-100']) {
      expect(bad).toMatch(APPEARANCE_CLASS);
    }
    expect('bg-[#1b5e4b]').toMatch(HARD_CODED);
    for (const good of [
      'bg-surface',
      'text-fg-muted',
      'border-line',
      'text-state-approved',
      'text-fg-subtle',
    ]) {
      expect(good).not.toMatch(APPEARANCE_CLASS);
    }
  });

  it.each(Object.entries(sources))('%s uses role tokens only', (_file, source) => {
    expect(source).not.toMatch(APPEARANCE_CLASS);
    expect(source).not.toMatch(HARD_CODED);
  });
});
