import { flushSync } from 'react-dom';
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';

/**
 * Toasts (Spec P5 §6.4) confirm that something worked: "Muster saved", "Export started". They are only ever
 * success or info. An error is never a toast: it stays on screen until dealt with, as an Alert, an ErrorState
 * or a field error, because a toast disappears before everyone has read it.
 */
export type ToastTone = 'success' | 'info';

export interface ToastContent {
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
}

/** Long enough to read (WCAG 2.2.1); hovering or focusing the region pauses it. */
const TIMEOUT_MS = 6000;

/** The one queue the app's ToastRegion shows. ui-internal: features call `toast.success` / `toast.info`. */
export const toastQueue = new ToastQueue<ToastContent>({
  maxVisibleToasts: 3,
  // Apply each change synchronously, so a toast is in the DOM as soon as `toast.*` returns.
  wrapUpdate: (fn) => {
    flushSync(fn);
  },
});

function show(tone: ToastTone, title: string, description?: string): string {
  return toastQueue.add({ tone, title, ...(description ? { description } : {}) }, { timeout: TIMEOUT_MS });
}

export const toast = {
  /** Something the user did worked: "Muster saved". */
  success: (title: string, description?: string) => show('success', title, description),
  /** Neutral news: "Export started. It will be in Downloads in a minute." */
  info: (title: string, description?: string) => show('info', title, description),
  /** Closes one toast (by the id `success`/`info` returned) or all of them. */
  dismiss: (id?: string) => {
    if (id) toastQueue.close(id);
    else toastQueue.clear();
  },
};
