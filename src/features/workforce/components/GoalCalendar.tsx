import { useState } from 'react';

import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, EmptyState, Link, Skeleton } from '@/ui';

import { type CalendarEvent, useGoalCalendar } from '../api/performance';

const TONES: Record<CalendarEvent['kind'], BadgeTone> = { start: 'info', review: 'warning', due: 'danger' };

const pad = (n: number) => String(n).padStart(2, '0');
/** The first and last day of a month as business dates (no timezone: plain year-month arithmetic). */
function monthRange(year: number, month: number) {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    from: `${String(year)}-${pad(month + 1)}-01`,
    to: `${String(year)}-${pad(month + 1)}-${pad(last)}`,
  };
}

/**
 * The goals calendar (goal.view): the start, review and due dates of the goals in a month, day by day, with the
 * way to the previous and next month.
 */
export function GoalCalendar({ estateId }: { readonly estateId: string | null }) {
  const { t, i18n } = useTranslation('workforce');
  const format = useFormat();
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const { from, to } = monthRange(cursor.year, cursor.month);
  const events = useGoalCalendar(from, to, estateId);
  const step = (by: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + by, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };
  const days = new Map<string, CalendarEvent[]>();
  for (const event of events.data ?? []) days.set(event.date, [...(days.get(event.date) ?? []), event]);

  return (
    <section aria-label={t('goals.calendar')} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {new Intl.DateTimeFormat(i18n.language === 'bn' ? 'bn-BD' : 'en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(`${from}T00:00:00Z`))}
        </h2>
        <span className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              step(-1);
            }}
          >
            {t('goals.previousMonth')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              step(1);
            }}
          >
            {t('goals.nextMonth')}
          </Button>
        </span>
      </div>
      {events.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={4} />
      ) : events.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-danger">{t('members.failed')}</span>
          <Button size="sm" variant="secondary" onPress={() => void events.refetch()}>
            {t('employment.retry')}
          </Button>
        </div>
      ) : days.size === 0 ? (
        <EmptyState
          kind="new"
          title={t('goals.calendarEmptyTitle')}
          description={t('goals.calendarEmptyBody')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {[...days.entries()].map(([date, list]) => (
            <li key={date} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-6">
              <span className="w-32 shrink-0 font-medium">{format.date(date)}</span>
              <ul className="flex flex-1 flex-col gap-2">
                {list.map((event) => (
                  <li
                    key={`${event.goal_id}-${event.kind}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <Badge tone={TONES[event.kind]} label={t(`goalEvents.${event.kind}`)} />
                    <Link href={`/hr/goals/${event.goal_id}`}>{event.title}</Link>
                    <span className="font-mono text-fg-muted">{event.goal_code}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
