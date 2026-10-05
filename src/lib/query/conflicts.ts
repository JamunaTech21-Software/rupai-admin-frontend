/**
 * Version conflicts waiting for the user (Spec P4 §5.1). When a save answers 409 VERSION_CONFLICT the mutation
 * reports it here; the ConflictDialog host (features/system) shows "This record was changed by someone else"
 * and, on Reload, runs `reload` to fetch the latest version. The user then reapplies their change.
 */
export interface Conflict {
  readonly id: number;
  /** What was being saved: "Worker Rahim Uddin". */
  readonly subject: string;
  readonly requestId: string | null;
  /** Refetches the record so the form shows the current version. */
  readonly reload: () => void | Promise<void>;
}

type Listener = (conflict: Conflict | null) => void;
let current: Conflict | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

export function reportConflict(conflict: Omit<Conflict, 'id'>): void {
  current = { ...conflict, id: nextId++ };
  for (const listener of listeners) listener(current);
}

export function resolveConflict(): void {
  current = null;
  for (const listener of listeners) listener(null);
}

export function currentConflict(): Conflict | null {
  return current;
}

export function subscribeConflicts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
