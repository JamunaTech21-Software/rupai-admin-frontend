import { useCallback, useRef } from 'react';

/**
 * Idempotency-Key for transitions (Spec P4 §5.2). The network can fail after the server committed an approval;
 * retrying with the SAME key gets the original answer instead of a second approval. So a key is made on the
 * first press of an action and reused for every retry of it, and a new one is made only after it succeeded.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * One key per user action: `key()` returns the current key (making it on first use), `reset()` after success
 * so the next, separate action gets a fresh one.
 *
 *   const idem = useIdempotencyKey();
 *   approve.mutate({ id, version, idempotencyKey: idem.key() }, { onSuccess: idem.reset });
 */
export function useIdempotencyKey() {
  const current = useRef<string | null>(null);
  const key = useCallback(() => {
    current.current ??= newIdempotencyKey();
    return current.current;
  }, []);
  const reset = useCallback(() => {
    current.current = null;
  }, []);
  return { key, reset };
}
