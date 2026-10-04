import { useState } from 'react';

import { type TokenValues } from '../types';

/**
 * Reads the current value of each custom property from :root, so the reference shows what the browser is
 * actually using rather than a copy of the stylesheet.
 */
export function useTokenValues(names: readonly string[]): TokenValues {
  // The stylesheet is loaded before any route renders, so the values can be read once, on first render.
  const [values] = useState<TokenValues>(() => {
    const style = getComputedStyle(document.documentElement);
    return new Map(names.map((name) => [name, style.getPropertyValue(name).trim()]));
  });
  return values;
}

/** The value to display for a token: an em dash when the browser reports none. */
export function displayValue(values: TokenValues, name: string): string {
  const value = values.get(name);
  return value === undefined || value === '' ? '—' : value;
}
