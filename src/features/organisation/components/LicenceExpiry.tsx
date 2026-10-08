import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

const SOON_DAYS = 30;

/** Today and a date `days` ahead as YYYY-MM-DD, in the estate's timezone (Dhaka, no daylight saving). */
function dhakaDate(days = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

/** "Expired" before today, "Expires soon" within 30 days, nothing otherwise. */
function licenceState(expiry: string | null): 'expired' | 'expiring' | null {
  if (!expiry) return null;
  if (expiry < dhakaDate()) return 'expired';
  if (expiry <= dhakaDate(SOON_DAYS)) return 'expiring';
  return null;
}

/** A licence expiry date, flagged when it has passed or is close (a factory cannot operate without one). */
export function LicenceExpiry({ expiry }: { readonly expiry: string | null }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  if (!expiry) return null;
  const state = licenceState(expiry);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="whitespace-nowrap">{format.date(expiry)}</span>
      {state ? (
        <Badge
          tone={state === 'expired' ? 'danger' : 'warning'}
          label={state === 'expired' ? t('licence.expired') : t('licence.expiring')}
        />
      ) : null}
    </span>
  );
}
