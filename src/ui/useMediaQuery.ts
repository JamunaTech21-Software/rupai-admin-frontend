import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, updating live. Without `matchMedia` (tests, very old browsers) it reports
 * `fallback`. Breakpoints match tokens.css: md = 48rem.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** md and up: the table layout; below it, cards. */
export const MD_UP = '(min-width: 48rem)';
