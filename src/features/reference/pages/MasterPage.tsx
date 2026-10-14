import { useParams } from 'react-router';

import { ForbiddenState, NotFoundState } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

import { MasterScreen } from '../components/MasterScreen';
import { masterBySlug } from '../masters';

/**
 * Reference data → one master (P1.10): /masters/{type}. One page serves every master; each has its own view
 * permission, so the page checks it instead of the route.
 */
export function MasterPage() {
  const { type: slug } = useParams();
  const { t } = useTranslation('ref');
  const type = masterBySlug(slug);
  const canView = usePermission(type ? `${type.permission}.view` : 'lookup.view');
  if (!type) return <NotFoundState />;
  if (!canView) return <ForbiddenState />;
  return (
    <MasterScreen
      // A new screen per master: its list, filters and form belong to that master.
      key={type.key}
      type={type}
      breadcrumbs={[{ label: t('title'), href: '/masters' }, { label: t(`types.${type.key}.title`) }]}
    />
  );
}

export { MasterPage as Component };
