/**
 * Remembered column choices for a DataTable (Spec P5 §6.3: "column visibility persisted per user").
 *
 * For now they live in this browser's storage, keyed by table and (once sign-in exists, F0.07) by user. When the
 * backend gets a user-preferences endpoint the same two functions will read and write it instead. Storage can
 * be unavailable (private windows, blocked site data): every access is guarded and the table falls back to its
 * default columns.
 */
const PREFIX = 'rupai:table-columns:';

export function columnStorageKey(tableKey: string, userId?: string | null): string {
  return `${PREFIX}${userId ? `${userId}:` : ''}${tableKey}`;
}

/** The hidden column ids saved for this table, or null when nothing is saved. */
export function loadHiddenColumns(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

export function saveHiddenColumns(key: string, hidden: readonly string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(hidden));
  } catch {
    // Storage unavailable: the choice lasts until the page is reloaded.
  }
}
