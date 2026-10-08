import { useTranslation } from '@/lib/i18n';
import { QuantityInput, type QuantityInputProps } from '@/ui';

/** An area in hectares, to 3 decimal places ("12.500 ha"), as the backend stores it (DECIMAL(14,3)). */
export function AreaInput(props: Omit<QuantityInputProps, 'unit' | 'unitName'>) {
  const { t } = useTranslation('org');
  return <QuantityInput {...props} unit="ha" unitName={t('units.hectares')} />;
}
