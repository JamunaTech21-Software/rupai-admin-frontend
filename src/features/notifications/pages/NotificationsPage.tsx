import { useState } from 'react';

import { PageError, RefusalDialog } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import { Button, Card, EmptyState, PageHeader, Pagination, Select, Skeleton, Stack, Tabs, toast } from '@/ui';

import { SEVERITIES, useNotificationsList, useReadAll, useNotificationSummary } from '../api/notifications';
import { NotificationItem } from '../components/NotificationItem';

const READ = filterKey('is_read');
const DISMISSED = filterKey('is_dismissed');
const SEVERITY = filterKey('severity');
const ANY = 'any';

type View = 'all' | 'unread' | 'dismissed';

/**
 * Notifications (P1.16): the signed-in user's own, newest first, in three views: all (dismissed ones are left out),
 * unread, and dismissed. Opening one marks it read and goes to what it is about. "Mark all as read" marks everything
 * up to the newest one shown, so one arriving meanwhile stays unread. Every user has their own: no permission is needed.
 */
export function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const list = useNotificationsList();
  const summary = useNotificationSummary();
  const readAll = useReadAll();
  const [refusal, setRefusal] = useState<unknown>(null);
  const { table, rows } = list;

  const view: View =
    table.filters[DISMISSED] === 'true' ? 'dismissed' : table.filters[READ] === 'false' ? 'unread' : 'all';
  const unread = summary.data?.unread ?? 0;

  async function markAllRead() {
    try {
      const done = await readAll.mutateAsync({ upToId: rows[0]?.id ?? null });
      toast.success(t('allMarked', { count: done.marked_read }));
    } catch (error) {
      setRefusal(error);
    }
  }

  const choose = (next: string) => {
    table.setFilters({
      [READ]: next === 'unread' ? 'false' : null,
      [DISMISSED]: next === 'dismissed' ? 'true' : null,
    });
  };

  const body = (() => {
    if (list.query.isPending) return <Skeleton variant="block" className="h-48 w-full" />;
    if (list.query.isError && rows.length === 0)
      return <PageError error={list.query.error} onRetry={() => void list.query.refetch()} />;
    if (rows.length === 0) {
      return table.hasFilters ? (
        <EmptyState
          kind="no-results"
          title={t(`empty.${view}.title`)}
          description={t(`empty.${view}.body`)}
          action={
            <Button variant="secondary" onPress={table.clearFilters}>
              {t('clear')}
            </Button>
          }
        />
      ) : (
        <EmptyState kind="new" title={t('empty.all.title')} description={t('empty.all.body')} />
      );
    }
    return (
      <ul aria-label={t('title')} className="flex flex-col">
        {rows.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onRefused={setRefusal} />
        ))}
      </ul>
    );
  })();

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          view === 'dismissed' ? undefined : (
            <Button
              variant="secondary"
              iconStart="checkCircle"
              isDisabled={unread === 0}
              isPending={readAll.isPending}
              onPress={() => {
                void markAllRead();
              }}
            >
              {t('markAllRead')}
            </Button>
          )
        }
      />
      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs
            label={t('views.label')}
            selectedKey={view}
            onSelectionChange={choose}
            items={[
              { id: 'all', label: t('views.all'), content: null },
              { id: 'unread', label: t('views.unread'), count: unread, content: null },
              { id: 'dismissed', label: t('views.dismissed'), content: null },
            ]}
          />
          <Select
            label={t('filters.severity')}
            className="w-full sm:w-48"
            value={table.filters[SEVERITY] ?? ANY}
            options={[
              { id: ANY, label: t('filters.anySeverity') },
              ...SEVERITIES.map((severity) => ({ id: severity, label: t(`severity.${severity}`) })),
            ]}
            onChange={(value) => {
              table.setFilter(SEVERITY, value === null || value === ANY ? null : value);
            }}
          />
        </div>
        {body}
      </Card>
      {list.total > 0 ? <Pagination {...list.tableProps.pagination} itemLabel={t('itemLabel')} /> : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { NotificationsPage as Component };
