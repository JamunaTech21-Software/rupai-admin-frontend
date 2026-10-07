/** Checked in order: Edge and Opera also say "Chrome", and Chrome also says "Safari". */
const BROWSERS: readonly (readonly [name: string, markers: readonly string[]])[] = [
  ['Edge', ['Edg/']],
  ['Opera', ['OPR/', 'Opera']],
  ['Firefox', ['Firefox/']],
  ['Chrome', ['Chrome/']],
  ['Safari', ['Safari/']],
];

/** Android also says "Linux"; iOS also says "Mac OS X". */
const SYSTEMS: readonly (readonly [name: string, markers: readonly string[]])[] = [
  ['Android', ['Android']],
  ['iOS', ['iPhone', 'iPad', 'iPod']],
  ['Windows', ['Windows']],
  ['macOS', ['Mac OS X', 'Macintosh']],
  ['Linux', ['Linux']],
];

function first(userAgent: string, table: typeof BROWSERS): string | null {
  return table.find(([, markers]) => markers.some((marker) => userAgent.includes(marker)))?.[0] ?? null;
}

/**
 * A short, readable name for a session's device from its User-Agent ("Chrome on Windows"). Only the common
 * browsers and systems are named; anything else is null and the screen says "Unknown device".
 */
export function describeDevice(userAgent: string | null): { browser: string | null; system: string | null } {
  if (!userAgent) return { browser: null, system: null };
  return { browser: first(userAgent, BROWSERS), system: first(userAgent, SYSTEMS) };
}

/** Phones and tablets get a phone icon; everything else a computer. */
export function isMobileDevice(userAgent: string | null): boolean {
  return (
    userAgent !== null && ['Android', 'iPhone', 'iPad', 'iPod', 'Mobile'].some((m) => userAgent.includes(m))
  );
}
