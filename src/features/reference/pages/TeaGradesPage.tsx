import { useTranslation } from '@/lib/i18n';

import { MasterScreen } from '../components/MasterScreen';
import { masterType } from '../masters';

const TEA_GRADE = masterType('tea_grade');

/**
 * Reference data → Tea grades (P1.10). A grade belongs to one tea type or to all of them; the tea type filter
 * shows what may be chosen for that type: its own grades and the universal ones.
 */
export function TeaGradesPage() {
  const { t } = useTranslation('ref');
  return (
    <MasterScreen
      type={TEA_GRADE}
      breadcrumbs={[{ label: t('title'), href: '/masters' }, { label: t('types.tea_grade.title') }]}
    />
  );
}

export { TeaGradesPage as Component };
