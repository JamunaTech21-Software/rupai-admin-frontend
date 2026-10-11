import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

import { licenceState } from '../licence';

/**
 * A licence expiry date, flagged when it has passed or is close (a factory cannot operate without one); "Not
 * recorded" when none was entered.
 */
export function LicenceExpiry({ expiry }: { readonly expiry: string | null }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  if (!expiry) return <span className="text-fg-subtle">{t('estates.notRecorded')}</span>;
  const state = licenceState(expiry);
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="whitespace-nowrap">{format.date(expiry)}</span>
      {state === 'expired' || state === 'expiring' ? (
        <Badge
          tone={state === 'expired' ? 'danger' : 'warning'}
          label={state === 'expired' ? t('licence.expired') : t('licence.expiring')}
        />
      ) : null}
    </span>
  );
}
