import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

/** Within this many days, an expiry is a warning (the backend's default window for the expiring list). */
const SOON_DAYS = 30;

/**
 * When a document runs out, in words and colour: expired is a danger, within 30 days a warning, later is plain.
 * Colour never stands alone: the label always says it. A document without an expiry date says so quietly.
 */
export function ExpiryBadge({
  expiryDate,
  daysToExpiry,
}: {
  readonly expiryDate: string | null;
  readonly daysToExpiry: number | null;
}) {
  const { t } = useTranslation('docs');
  const format = useFormat();
  if (expiryDate === null || daysToExpiry === null)
    return <span className="text-sm text-fg-muted">{t('noExpiry')}</span>;
  if (daysToExpiry < 0)
    return <Badge tone="danger" label={t('expiredDaysAgo', { count: Math.abs(daysToExpiry) })} />;
  if (daysToExpiry === 0) return <Badge tone="warning" label={t('expiresToday')} />;
  if (daysToExpiry <= SOON_DAYS)
    return <Badge tone="warning" label={t('expiresInDays', { count: daysToExpiry })} />;
  return <Badge tone="neutral" hideIcon label={t('expires', { date: format.date(expiryDate) })} />;
}
