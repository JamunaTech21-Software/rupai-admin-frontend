import { useFormat, useTranslation } from '@/lib/i18n';

/**
 * Areas are acres everywhere (decision of 2026-10-14, R.2): estates, divisions, sections and fields, as decimal
 * strings with 3 places. This is the one place that says so on screen.
 */
export function useArea() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const unit = t('units.acresShort');
  return {
    /** The short unit for inputs and cells: "acres" / "একর". */
    unit,
    /** The unit's full name for screen readers. */
    unitName: t('units.acres'),
    /** "12.500 acres". */
    format: (value: string) => format.quantity(value, unit),
  };
}
