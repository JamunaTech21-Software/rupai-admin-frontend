import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw/server';

// Whole-app tests wait for lazy route chunks and a sign-in: give findBy/waitFor room on a busy machine.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no IntersectionObserver; React Aria's "load more" sentinel (AsyncCombobox) needs one to mount.
// Nothing scrolls in jsdom, so a stub that never reports an intersection is accurate.
class NoIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {
    // Nothing to watch: jsdom never scrolls.
  }
  unobserve(): void {
    // Nothing is being watched.
  }
  disconnect(): void {
    // Nothing is being watched.
  }
  takeRecords() {
    return [];
  }
}
if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = NoIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Any request a test did not mock fails the test, so nothing reaches a real network.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
