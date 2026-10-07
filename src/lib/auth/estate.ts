import { useSyncExternalStore } from 'react';

import { type Me, useMe } from './me';

/**
 * The estate context (Spec P5 §3.3, §9.3): which of the user's estates the screens show. It narrows what the
 * user's data scope already allows, never widens it; the server enforces the scope regardless.
 *
 * The choice is a per-browser convenience, kept per user. A stored estate the user no longer holds is ignored,
 * so a revoked grant falls back to "all my estates".
 */

const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();

const storageKey = (userId: string) => `rupai.estate.${userId}`;

function read(userId: string): string | null {
  if (memory.has(userId)) return memory.get(userId) ?? null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function write(userId: string, estateId: string | null): void {
  memory.set(userId, estateId);
  try {
    if (estateId === null) window.localStorage.removeItem(storageKey(userId));
    else window.localStorage.setItem(storageKey(userId), estateId);
  } catch {
    // Storage blocked (private window): the choice lasts for this page only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface EstateContextValue {
  /** Unrestricted: every estate. Estate names to pick from arrive with estate set-up (P1.07). */
  readonly allEstates: boolean;
  /** The estates the user's scope names (ids), in order. */
  readonly estates: readonly string[];
  /** The chosen estate, or null for all of them. */
  readonly selected: string | null;
  readonly select: (estateId: string | null) => void;
}

/** The estates of a scope; for tests and the selector. */
export function scopedEstates(me: Pick<Me, 'scope'>): readonly string[] {
  return me.scope.estates ?? [];
}

export function useEstateContext(): EstateContextValue | null {
  const me = useMe();
  const userId = me?.user.id ?? '';
  const stored = useSyncExternalStore(subscribe, () => (userId ? read(userId) : null));
  if (!me) return null;
  const allEstates = me.scope.all_estates === true;
  const estates = scopedEstates(me);
  const selected = stored !== null && estates.includes(stored) ? stored : null;
  return {
    allEstates,
    estates,
    selected,
    select: (estateId) => {
      write(userId, estateId);
    },
  };
}

/** The chosen estate for list filters (`filter[estate_id]`), or null for everything in scope. */
export function useSelectedEstate(): string | null {
  return useEstateContext()?.selected ?? null;
}

/** Between tests. */
export function resetEstateContext(): void {
  memory.clear();
}
