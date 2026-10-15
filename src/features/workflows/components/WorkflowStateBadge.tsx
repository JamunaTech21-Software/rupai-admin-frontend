import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

import { type WorkflowState } from '../api/workflows';
import { stateTone } from './stateTone';

/** Where a workflow version stands: draft, submitted for approval, active, rejected or superseded. */
export function WorkflowStateBadge({ state }: { readonly state: WorkflowState }) {
  const { t } = useTranslation('workflows');
  return <Badge tone={stateTone(state)} label={t(`states.${state}`)} />;
}
