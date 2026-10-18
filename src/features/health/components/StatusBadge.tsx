import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone } from '@/ui';

import { type CheckStatus } from '../api/health';

const TONE: Record<CheckStatus, BadgeTone> = {
  ok: 'success',
  warning: 'warning',
  critical: 'danger',
  unknown: 'neutral',
  not_applicable: 'neutral',
};

/** A check's status in words and colour: healthy, needs a look, broken, could not be read, or not applicable yet. */
export function StatusBadge({ status }: { readonly status: CheckStatus }) {
  const { t } = useTranslation('health');
  return <Badge tone={TONE[status]} label={t(`status.${status}`)} />;
}
