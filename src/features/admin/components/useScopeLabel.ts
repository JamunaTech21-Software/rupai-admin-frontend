import { useTranslation } from '@/lib/i18n';

import { type ScopeGrant } from '../api/schemas';

/** `estate` 7 → "Estate 7"; all_estates names no target. Names replace numbers with estate set-up (P1.07). */
export function useScopeLabel() {
  const { t } = useTranslation('admin');
  return (grant: Pick<ScopeGrant, 'scope_type' | 'scope_id'>) =>
    grant.scope_id === null
      ? t(`scope.types.${grant.scope_type}`)
      : t('scope.targetLabel', { type: t(`scope.types.${grant.scope_type}`), id: grant.scope_id });
}
