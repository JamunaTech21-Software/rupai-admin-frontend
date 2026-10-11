import { useFormat, useTranslation } from '@/lib/i18n';
import { StatCard } from '@/ui';

import { useDivisions, useFieldTotals } from '../api/hierarchy';
import { type Estate } from '../api/schemas';

/**
 * The estate at a glance: its recorded total area, and what its fields and divisions add up to. The field figures
 * come from the fields themselves, so they show even when the estate's own total area was never entered.
 */
export function EstateSummary({ estate }: { readonly estate: Estate }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const totals = useFieldTotals(estate.id);
  const divisions = useDivisions(estate.id);
  const fields = totals.data?.get(estate.id);
  const pending = '…';
  const area = (value: string | undefined) => (value === undefined ? pending : format.decimal(value, 3));

  return (
    <section aria-label={t('estate.summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard
        label={t('estate.totalArea')}
        value={estate.total_area ? format.decimal(estate.total_area, 3) : t('estates.notRecorded')}
        {...(estate.total_area ? { unit: 'ha' } : {})}
      />
      <StatCard
        label={t('estate.fieldArea')}
        value={totals.isPending ? pending : area(fields?.gross ?? '0')}
        unit="ha"
      />
      <StatCard
        label={t('estate.plantedArea')}
        value={totals.isPending ? pending : area(fields?.planted ?? '0')}
        unit="ha"
      />
      <StatCard
        label={t('estate.fieldCount')}
        value={totals.isPending ? pending : format.number(fields?.count ?? 0)}
      />
      <StatCard
        label={t('estate.divisionCount')}
        value={divisions.isPending ? pending : format.number(divisions.data?.length ?? 0)}
      />
    </section>
  );
}
