import { useTranslation } from '@/lib/i18n';

import { type LifecycleText } from './components/NodeLifecycle';

/** What the deactivate / reactivate / delete dialogs say about a division or section. */
export function useStructureText(name: string): LifecycleText {
  const { t } = useTranslation('org');
  return {
    deactivateTitle: t('structure.deactivateTitle', { name }),
    deactivateBody: t('structure.deactivateBody'),
    reactivateTitle: t('structure.reactivateTitle', { name }),
    reactivateBody: t('structure.reactivateBody'),
    deleteTitle: t('structure.deleteTitle', { name }),
    deleteBody: t('structure.deleteBody'),
    deactivated: t('structure.deactivated', { name }),
    reactivated: t('structure.reactivated', { name }),
    deleted: t('structure.deleted', { name }),
  };
}
