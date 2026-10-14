import { useTranslation } from '@/lib/i18n';

import { MasterScreen } from '../components/MasterScreen';
import { UomCategories } from '../components/UomCategories';
import { masterType } from '../masters';

const UOM = masterType('uom');

/**
 * Reference data → Units of measure (P1.10): the units, and under them the unit categories with the base unit
 * each category's conversion factors are expressed against.
 */
export function UomsPage() {
  const { t } = useTranslation('ref');
  return (
    <MasterScreen
      type={UOM}
      breadcrumbs={[{ label: t('title'), href: '/masters' }, { label: t('types.uom.title') }]}
    >
      <UomCategories />
    </MasterScreen>
  );
}

export { UomsPage as Component };
