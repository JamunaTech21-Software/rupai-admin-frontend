import { useNavigate } from 'react-router';

import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { cx, IconButton } from '@/ui';

import { type AppNotification, useNotificationAction } from '../api/notifications';
import { SeverityBadge } from './SeverityBadge';

/**
 * One notification: what it says, how much it matters, when, and what the user can do with it. Opening it marks it read
 * and goes to what it is about (`link.route`); the small buttons mark it read or unread and dismiss or restore it. A
 * dismissed one is out of the unread count and the default list, and can be brought back.
 */
export function NotificationItem({
  notification,
  onOpen,
  onRefused,
}: {
  readonly notification: AppNotification;
  /** Called after a notification was opened (the bell closes its panel). */
  readonly onOpen?: () => void;
  readonly onRefused?: (error: unknown) => void;
}) {
  const { t } = useTranslation('notifications');
  const format = useFormat();
  const navigate = useNavigate();
  const action = useNotificationAction();
  const isDismissed = notification.dismissed_at !== null;

  async function run(kind: 'read' | 'unread' | 'dismiss' | 'restore') {
    try {
      await action.mutateAsync({ id: notification.id, action: kind });
      return true;
    } catch (error) {
      if (errorBehaviour(error) !== 'conflict') onRefused?.(error);
      return false;
    }
  }

  async function open() {
    if (!notification.is_read) await run('read');
    onOpen?.();
    void navigate(notification.link.route);
  }

  return (
    <li
      className={cx(
        'flex items-start gap-2 border-b border-line px-3 py-3 last:border-b-0',
        notification.is_read || isDismissed ? 'bg-surface' : 'bg-primary-subtle',
      )}
    >
      <button
        type="button"
        onClick={() => {
          void open();
        }}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-sm text-start outline-none focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={cx('text-fg', notification.is_read ? 'font-normal' : 'font-semibold')}>
            {notification.subject}
          </span>
          <SeverityBadge severity={notification.severity} />
          {notification.is_read ? null : <span className="text-xs font-medium text-primary">{t('new')}</span>}
        </span>
        <span className="text-sm text-fg-muted">{notification.body}</span>
        <span className="text-xs text-fg-subtle">
          {notification.rule.name} · {format.dateTime(notification.created_at)}
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-1">
        {isDismissed ? null : (
          <IconButton
            icon={notification.is_read ? 'inbox' : 'checkCircle'}
            variant="ghost"
            size="sm"
            label={t(notification.is_read ? 'markUnread' : 'markRead', { subject: notification.subject })}
            onPress={() => {
              void run(notification.is_read ? 'unread' : 'read');
            }}
          />
        )}
        <IconButton
          icon={isDismissed ? 'refresh' : 'close'}
          variant="ghost"
          size="sm"
          label={t(isDismissed ? 'restore' : 'dismiss', { subject: notification.subject })}
          onPress={() => {
            void run(isDismissed ? 'restore' : 'dismiss');
          }}
        />
      </span>
    </li>
  );
}
