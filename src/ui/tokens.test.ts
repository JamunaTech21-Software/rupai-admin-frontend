/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { ALL_TOKENS, CONTRAST_PAIRS, TEXT_TOKENS } from './tokens';

// Read from disk: Vitest does not process CSS imports, so `?raw` would come back empty.
const readStyles = (file: string) => readFileSync(`${process.cwd()}/src/ui/styles/${file}`, 'utf8');
const tokensCss = readStyles('tokens.css');
const baseCss = readStyles('base.css');

/** The custom properties declared in the `@theme static` block, comments removed. */
function themeTokens(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = withoutComments.indexOf('@theme static {');
  const end = withoutComments.indexOf('\n}', start);
  const block = withoutComments.slice(start, end);
  const tokens = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!name || value === undefined || value.trim() === 'initial' || name.endsWith('--line-height'))
      continue;
    tokens.set(name, value.replace(/\s+/g, ' ').trim());
  }
  return tokens;
}

const declared = themeTokens(tokensCss);
const rem = (name: string) => {
  const value = declared.get(name) ?? '';
  expect(value, name).toMatch(/^[\d.]+rem$/);
  return Number.parseFloat(value); // eslint-disable-line no-restricted-properties -- a CSS length, not money
};

describe('design tokens', () => {
  it('lists every token in the catalogue, and nothing that is not declared', () => {
    const catalogued = ALL_TOKENS.map((token) => token.name);
    expect(new Set(catalogued).size).toBe(catalogued.length);
    expect([...declared.keys()].sort()).toEqual([...catalogued].sort());
  });

  it('switches off the default appearance-named palette and scales', () => {
    for (const reset of ['--color-*', '--text-*', '--radius-*', '--shadow-*', '--breakpoint-*', '--font-*']) {
      expect(tokensCss).toContain(`${reset}: initial;`);
    }
  });

  it.each(CONTRAST_PAIRS.map((p) => [`${p.fg} on ${p.bg}`, p] as const))('%s meets WCAG AA', (_label, p) => {
    const fg = declared.get(p.fg);
    const bg = declared.get(p.bg);
    expect(fg, p.fg).toBeDefined();
    expect(bg, p.bg).toBeDefined();
    expect(contrastRatio(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(p.min);
  });

  it('uses the mobile-first breakpoints sm 640, md 768, lg 1024, xl 1280', () => {
    expect(['sm', 'md', 'lg', 'xl'].map((bp) => rem(`--breakpoint-${bp}`) * 16)).toEqual([
      640, 768, 1024, 1280,
    ]);
  });

  it('builds the type scale on a 1.200 ratio from a 16 px base', () => {
    const sizes = TEXT_TOKENS.map((token) => rem(token.name));
    expect(rem('--text-base')).toBe(1);
    for (let i = 1; i < sizes.length; i += 1) {
      expect((sizes[i] ?? 0) / (sizes[i - 1] ?? 1)).toBeCloseTo(1.2, 2);
    }
  });

  it('uses a 4 px spacing grid and 44 px touch targets', () => {
    expect(rem('--spacing') * 16).toBe(4);
    expect(rem('--size-touch-target') * 16).toBe(44);
  });

  it('includes a Bengali-capable face in the font stack', () => {
    expect(declared.get('--font-sans')).toContain('Noto Sans Bengali');
  });

  it('keeps body text at 16 px and enforces touch targets below md', () => {
    expect(baseCss).toMatch(/font-size:\s*var\(--text-base\)/);
    expect(baseCss).toMatch(/@media \(width < 48rem\)[\s\S]*min-height:\s*var\(--size-touch-target\)/);
  });
});
