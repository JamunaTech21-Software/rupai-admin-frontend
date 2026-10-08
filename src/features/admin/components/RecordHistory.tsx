import { useTranslation } from '@/lib/i18n';
import { Button, EmptyState, Stack, type TimelineEvent, Timeline } from '@/ui';

import { PageError, PageLoading } from '@/features/system';

import { useRecordChanges, useRecordStatusHistory } from '../api/audit';

import { moduleLabel } from '../labels';

import { AuditValue } from './AuditValue';

/**
 * One record's history (P1.05): its field changes and status transitions on one timeline, oldest first as
 * history reads, with "Load earlier" for longer histories. Needs audit.view; the caller decides whether to show it.
 */
export function RecordHistory({
  recordType,
  recordId,
}: {
  readonly recordType: string;
  readonly recordId: string;
}) {
  const { t } = useTranslation('admin');
  const changes = useRecordChanges(recordType, recordId);
  const statuses = useRecordStatusHistory(recordType, recordId);

  if (changes.isPending || statuses.isPending) return <PageLoading rows={4} />;
  if (changes.isError) return <PageError error={changes.error} onRetry={() => void changes.refetch()} />;
  if (statuses.isError) return <PageError error={statuses.error} onRetry={() => void statuses.refetch()} />;

  const system = t('audit.system');
  const events: (TimelineEvent & { sort: string })[] = [
    ...changes.data.pages.flatMap((page) =>
      page.data.map((row) => ({
        id: `c${row.id}`,
        sort: row.changed_at,
        at: row.changed_at,
        actor: row.changed_by?.username ?? system,
        title:
          row.action === 'update' && row.field
            ? t('history.fieldChanged', { field: moduleLabel(row.field) })
            : t('history.recordAction', { action: t(`audit.actions.${row.action}`) }),
        note: (
          <span className="flex flex-col gap-1">
            {row.old_value !== null ? <AuditValue value={row.old_value} tone="old" /> : null}
            {row.new_value !== null ? <AuditValue value={row.new_value} tone="new" /> : null}
            {row.reason ? <span className="text-fg-muted">{row.reason}</span> : null}
          </span>
        ),
      })),
    ),
    ...statuses.data.pages.flatMap((page) =>
      page.data.map((row) => ({
        id: `s${row.id}`,
        sort: row.changed_at,
        at: row.changed_at,
        actor: row.changed_by?.username ?? system,
        title: row.from_state
          ? t('history.statusChanged', { from: row.from_state, to: row.to_state })
          : t('history.statusSet', { to: row.to_state }),
        ...(row.comment ? { note: row.comment } : {}),
      })),
    ),
  ].sort((a, b) => a.sort.localeCompare(b.sort));

  const hasMore = changes.hasNextPage || statuses.hasNextPage;

  if (events.length === 0) {
    return <EmptyState kind="new" title={t('history.emptyTitle')} description={t('history.emptyBody')} />;
  }
  return (
    <Stack gap={3}>
      {hasMore ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          isPending={changes.isFetchingNextPage || statuses.isFetchingNextPage}
          onPress={() => {
            if (changes.hasNextPage) void changes.fetchNextPage();
            if (statuses.hasNextPage) void statuses.fetchNextPage();
          }}
        >
          {t('history.loadEarlier')}
        </Button>
      ) : null}
      <Timeline label={t('history.label')} events={events.map(({ sort: _sort, ...event }) => event)} />
    </Stack>
  );
}
