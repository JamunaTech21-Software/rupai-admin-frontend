/**
 * Screen-reader announcements through two shared live regions (polite and assertive), created on first use.
 * Use for outcomes that are not otherwise visible to assistive technology: "Saved", "3 rows selected",
 * "Search returned 12 workers". Toasts (F0.05) and form errors (F0.04) use this too.
 */
export type Politeness = 'polite' | 'assertive';

const REGION_ID = { polite: 'rupai-live-polite', assertive: 'rupai-live-assertive' } as const;

function region(politeness: Politeness): HTMLElement {
  const existing = document.getElementById(REGION_ID[politeness]);
  if (existing) return existing;
  const element = document.createElement('div');
  element.id = REGION_ID[politeness];
  element.className = 'sr-only';
  element.setAttribute('aria-live', politeness);
  element.setAttribute('aria-atomic', 'true');
  element.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
  document.body.append(element);
  return element;
}

/**
 * Announces a message. Assertive interrupts the user, so keep it for errors that need immediate attention.
 * The region is cleared first, so repeating the same message is announced again.
 */
export function announce(message: string, politeness: Politeness = 'polite'): void {
  const element = region(politeness);
  element.textContent = '';
  // A new text node on the next frame makes screen readers treat it as a change.
  window.setTimeout(() => {
    element.textContent = message;
  }, 50);
}
