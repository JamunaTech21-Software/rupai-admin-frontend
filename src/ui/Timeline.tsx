import { type ReactNode } from 'react';

import { formatDateTime } from '@/lib/dates';

import { Badge } from './Badge';
import { cx } from './cx';
import { type DocumentState } from './tokens';
import { useUiText } from './uiText';

export interface TimelineEvent {
  readonly id: string;
  /** What happened: "Submitted for approval", "Approved", "Rate changed". */
  readonly title: string;
  /** The document state it moved to, shown as its badge. */
  readonly state?: DocumentState;
  /** Who did it: "Shefali Das (Sardar)". */
  readonly actor?: string;
  /** When, as the API's ISO timestamp; shown in the estate's timezone. */
  readonly at: string;
  /** A reason or remark: a rejection reason, an approval note. */
  readonly note?: ReactNode;
}

export interface TimelineProps {
  /** Oldest first, as history reads. */
  readonly events: readonly TimelineEvent[];
  /** The list's accessible name: "Approval history". */
  readonly label: string;
  readonly className?: string;
}

const DOT: Partial<Record<DocumentState, string>> = {
  submitted: 'bg-state-submitted',
  approved: 'bg-state-approved',
  posted: 'bg-state-posted',
  rejected: 'bg-state-rejected',
  cancelled: 'bg-state-cancelled',
};

/** A document's status and approval history (Spec P5 §6.3): who did what, when, and why. */
export function Timeline({ events, label, className }: TimelineProps) {
  const text = useUiText();
  return (
    <ol aria-label={label} className={cx('flex flex-col', className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {isLast ? null : (
              <span aria-hidden="true" className="absolute start-[5px] top-4 bottom-0 w-px bg-line" />
            )}
            <span
              aria-hidden="true"
              className={cx(
                'relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface',
                (event.state && DOT[event.state]) ?? 'bg-fg-subtle',
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-fg">{event.title}</span>
                {event.state ? <Badge tone={event.state} label={text.documentState[event.state]} /> : null}
              </div>
              <p className="text-sm text-fg-muted">
                {event.actor ? <>{event.actor} · </> : null}
                <time dateTime={event.at}>{formatDateTime(event.at, undefined, text.dateLocale)}</time>
              </p>
              {event.note ? <div className="text-sm text-fg">{event.note}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
