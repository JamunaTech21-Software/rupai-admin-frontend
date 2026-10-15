import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

import { type RequestState } from '../api/approvals';
import { stateTone } from './stateTone';

/** Where an approval stands: pending, approved, rejected or returned for correction. */
export function ApprovalStateBadge({ state }: { readonly state: RequestState }) {
  const { t } = useTranslation('approvals');
  return <Badge tone={stateTone(state)} label={t(`states.${state}`)} />;
}
