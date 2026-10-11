import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert, StatCard } from '@/ui';

import { useAllEstates } from '../api/hierarchy';
import { type Factory } from '../api/schemas';
import { licenceState } from '../licence';

/**
 * The factory at a glance: its type, main estate, daily capacity and licence expiry, with a warning under the
 * cards when the licence has expired or expires within 30 days (a factory cannot operate without one).
 */
export function FactorySummary({ factory }: { readonly factory: Factory }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const estates = useAllEstates();
  const estate = estates.data?.find((e) => e.id === factory.primary_estate_id);
  const notRecorded = t('estates.notRecorded');
  const licence = licenceState(factory.licence_expiry);

  return (
    <section aria-label={t('factory.summary')} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('factory.type')} value={t(`factoryType.${factory.factory_type}`)} />
        <StatCard
          label={t('factory.primaryEstate')}
          value={factory.primary_estate_id ? (estate?.code ?? '…') : notRecorded}
        />
        <StatCard
          label={t('factory.dailyCapacity')}
          value={factory.daily_capacity_kg ? format.decimal(factory.daily_capacity_kg, 3) : notRecorded}
          {...(factory.daily_capacity_kg ? { unit: 'kg' } : {})}
        />
        <StatCard
          label={t('factory.licenceExpiry')}
          value={factory.licence_expiry ? format.date(factory.licence_expiry) : notRecorded}
        />
      </div>
      {factory.licence_expiry && (licence === 'expired' || licence === 'expiring') ? (
        <Alert
          tone={licence === 'expired' ? 'danger' : 'warning'}
          title={licence === 'expired' ? t('licence.expired') : t('licence.expiring')}
        >
          {t(licence === 'expired' ? 'licence.expiredBody' : 'licence.expiringBody', {
            date: format.date(factory.licence_expiry),
          })}
        </Alert>
      ) : null}
    </section>
  );
}
