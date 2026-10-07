import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

/** A user's or role's status, in words and with its shape (never colour alone). */
export function StatusBadge({ status }: { readonly status: 'active' | 'disabled' | 'inactive' }) {
  const { t } = useTranslation('admin');
  return <Badge tone={status === 'active' ? 'success' : 'neutral'} label={t(`status.${status}`)} />;
}
