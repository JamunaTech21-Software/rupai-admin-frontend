import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PageError, RefusalDialog } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { Button, cx, Drawer, EmptyState, IconButton, Skeleton, toast } from '@/ui';

import { useNotificationSummary, useReadAll, useRecentNotifications } from '../api/notifications';
import { NotificationItem } from './NotificationItem';

/**
 * The bell in the top bar (P1.16): the unread count on it (red when any is critical, 99+ when large), and a panel with
 * the newest notifications, "Mark all as read" and a link to the whole list. The count is polled every minute. Every
 * user has their own, so it needs no permission.
 */
export function NotificationBell() {
  const { t } = useTranslation('notifications');
  const summary = useNotificationSummary();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const recent = useRecentNotifications(isOpen);
  const readAll = useReadAll();
  const [refusal, setRefusal] = useState<unknown>(null);
  const unread = summary.data?.unread ?? 0;
  const rows = recent.data ?? [];

  async function markAllRead() {
    try {
      const done = await readAll.mutateAsync({ upToId: rows[0]?.id ?? null });
      toast.success(t('allMarked', { count: done.marked_read }));
    } catch (error) {
      setRefusal(error);
    }
  }

  const body = (() => {
    if (recent.isPending) return <Skeleton variant="block" className="m-4 h-40" />;
    if (recent.isError) return <PageError error={recent.error} onRetry={() => void recent.refetch()} />;
    if (rows.length === 0) {
      return <EmptyState kind="new" title={t('bellEmptyTitle')} description={t('bellEmptyBody')} />;
    }
    return (
      <ul aria-label={t('title')} className="flex flex-col">
        {rows.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onOpen={() => {
              setIsOpen(false);
            }}
            onRefused={setRefusal}
          />
        ))}
      </ul>
    );
  })();

  return (
    <>
      <span className="relative inline-flex">
        <IconButton
          icon="bell"
          variant="ghost"
          label={unread > 0 ? t('bellCount', { count: unread }) : t('bell')}
          onPress={() => {
            setIsOpen(true);
          }}
        />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className={cx(
              'pointer-events-none absolute -end-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full px-1 text-2xs leading-4.5 font-semibold text-fg-inverse figures',
              'bg-danger',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </span>
      <Drawer
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t('title')}
        description={t('panelIntro')}
        footer={
          <>
            <Button
              variant="secondary"
              isDisabled={unread === 0}
              isPending={readAll.isPending}
              onPress={() => {
                void markAllRead();
              }}
            >
              {t('markAllRead')}
            </Button>
            <Button
              onPress={() => {
                setIsOpen(false);
                void navigate('/notifications');
              }}
            >
              {t('viewAll')}
            </Button>
          </>
        }
      >
        {body}
      </Drawer>
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </>
  );
}
