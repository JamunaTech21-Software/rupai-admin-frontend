import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/ui';

import { type Organisation } from '../api/schemas';

/** The organisation at a glance: its short name, registration number, financial year start and status. */
export function OrganisationSummary({ organisation }: { readonly organisation: Organisation }) {
  const { t } = useTranslation('org');

  return (
    <section aria-label={t('organisation.summary')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('organisation.shortName')} value={organisation.short_name} />
        <StatCard
          label={t('organisation.registrationNumber')}
          value={organisation.registration_number ?? t('estates.notRecorded')}
        />
        <StatCard
          label={t('organisation.fiscalYearStart')}
          value={t(`months.m${String(organisation.fiscal_year_start_month)}` as 'months.m1')}
        />
        <StatCard label={t('organisation.status')} value={t(`status.${organisation.status}`)} />
      </div>
    </section>
  );
}
