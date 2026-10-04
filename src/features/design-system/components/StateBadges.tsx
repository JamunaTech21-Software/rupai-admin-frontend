import { DOCUMENT_STATES } from '@/ui';

/** Each document state as it will appear in a badge: its colour pair, always with its label (F0.03 Badge). */
export function StateBadges() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Document state badges">
      {DOCUMENT_STATES.map((state) => (
        <li
          key={state}
          className="rounded-sm border px-2 py-0.5 text-sm font-medium capitalize"
          style={{
            color: `var(--color-state-${state})`,
            backgroundColor: `var(--color-state-${state}-subtle)`,
            borderColor: `var(--color-state-${state})`,
          }}
        >
          {state}
        </li>
      ))}
    </ul>
  );
}
