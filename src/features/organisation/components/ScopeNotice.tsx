import { useTranslation } from '@/lib/i18n';
import { Alert } from '@/ui';

import { useAllEstates } from '../api/hierarchy';
import { type AppliedScope } from '../api/schemas';

/**
 * "Showing: Rupai Hills Tea Estate" above a list, when the server filtered it by the user's data scope
 * (`meta.applied_scope`). Nothing for a user who sees every estate.
 */
export function ScopeNotice({ scope }: { readonly scope: Readonly<Record<string, unknown>> | null }) {
  const { t } = useTranslation('org');
  const estates = useAllEstates();
  const applied = scope as AppliedScope | null;
  if (applied?.all_estates !== false) return null;
  const names = (applied.estates ?? []).map(
    (id) => estates.data?.find((estate) => estate.id === id)?.name ?? `#${id}`,
  );
  if (names.length === 0) return null;
  return (
    <Alert tone="info" title={t('scope.showing', { estates: names.join(', ') })}>
      {t('scope.notice')}
    </Alert>
  );
}
