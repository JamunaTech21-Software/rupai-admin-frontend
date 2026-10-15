import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone } from '@/ui';

import { type Severity } from '../api/notifications';

const TONE: Record<Severity, BadgeTone> = { info: 'info', warning: 'warning', critical: 'danger' };

/** How much a notification matters: information, a warning, or critical. */
export function SeverityBadge({ severity }: { readonly severity: Severity }) {
  const { t } = useTranslation('notifications');
  return <Badge tone={TONE[severity]} label={t(`severity.${severity}`)} />;
}
