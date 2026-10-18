import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone } from '@/ui';

import { type BatchState } from '../api/imports';

const TONE: Record<BatchState, BadgeTone> = {
  validating: 'info',
  validated: 'submitted',
  rejected: 'danger',
  committing: 'info',
  committed: 'success',
  cancelled: 'draft',
};

/** Where an import stands: being checked, checked, refused, being saved, saved, or cancelled. */
export function BatchStateBadge({ state }: { readonly state: BatchState }) {
  const { t } = useTranslation('imports');
  return <Badge tone={TONE[state]} label={t(`states.${state}`)} />;
}
