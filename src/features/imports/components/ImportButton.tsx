import { useTranslation } from '@/lib/i18n';
import { ButtonLink } from '@/ui';

import { useImportTypes } from '../api/imports';

/**
 * "Import from file" for a list that can be filled from a spreadsheet: it opens the import wizard on that type. It
 * shows only when the server offers the type to this user (they need the type's create permission), so a list with
 * no import, or a user who may not, sees nothing.
 */
export function ImportButton({ type }: { readonly type: string }) {
  const { t } = useTranslation('imports');
  const types = useImportTypes();
  if (!types.data?.some((candidate) => candidate.key === type)) return null;
  return (
    <ButtonLink href={`/imports/new?type=${encodeURIComponent(type)}`} variant="secondary" iconStart="upload">
      {t('importFromFile')}
    </ButtonLink>
  );
}
