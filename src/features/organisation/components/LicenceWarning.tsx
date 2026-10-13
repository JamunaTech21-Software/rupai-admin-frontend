import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert } from '@/ui';

import { licenceState } from '../licence';

/**
 * A warning when a licence has expired or expires within 30 days (a factory or warehouse cannot operate without
 * one). Nothing when the licence is in order or none is recorded.
 */
export function LicenceWarning({ expiry }: { readonly expiry: string | null }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const state = licenceState(expiry);
  if (!expiry || (state !== 'expired' && state !== 'expiring')) return null;
  return (
    <Alert
      tone={state === 'expired' ? 'danger' : 'warning'}
      title={state === 'expired' ? t('licence.expired') : t('licence.expiring')}
    >
      {t(state === 'expired' ? 'licence.expiredBody' : 'licence.expiringBody', { date: format.date(expiry) })}
    </Alert>
  );
}
