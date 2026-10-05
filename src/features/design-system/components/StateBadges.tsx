import { Badge, DOCUMENT_STATES } from '@/ui';

const LABEL: Record<(typeof DOCUMENT_STATES)[number], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  posted: 'Posted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/** Each document state as a Badge: its colour pair, its own icon shape, and always its label. */
export function StateBadges() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Document state badges">
      {DOCUMENT_STATES.map((state) => (
        <li key={state}>
          <Badge tone={state} label={LABEL[state]} />
        </li>
      ))}
    </ul>
  );
}
