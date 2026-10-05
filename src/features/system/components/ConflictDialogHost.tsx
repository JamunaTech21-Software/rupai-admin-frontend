import { useSyncExternalStore } from 'react';

import { useTranslation } from '@/lib/i18n';
import { currentConflict, resolveConflict, subscribeConflicts } from '@/lib/query';
import { ConfirmDialog } from '@/ui';

/**
 * Shows the conflict dialog when a save hit 409 VERSION_CONFLICT (Spec P4 §5.1): someone else saved the record
 * after this user opened it. Overwriting their change silently is not an option, so the only way on is to load
 * the latest version and make the change again. Rendered once, in the root layout.
 */
export function ConflictDialogHost() {
  const { t } = useTranslation('system');
  const conflict = useSyncExternalStore(subscribeConflicts, currentConflict, currentConflict);
  return (
    <ConfirmDialog
      isOpen={conflict !== null}
      onOpenChange={(open) => {
        if (!open) resolveConflict();
      }}
      title={t('conflictTitle')}
      consequence={t('conflictBody', { subject: conflict?.subject ?? t('conflictSubject') })}
      confirmLabel={t('conflictReload')}
      cancelLabel={t('conflictLater')}
      onConfirm={async () => {
        await conflict?.reload();
        resolveConflict();
      }}
    />
  );
}
