import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

import { type AuthorisationKind } from '../api/schemas';

/** The permission codes involved, as small code chips. */
export function PermissionChips({
  permissions,
  label,
}: {
  readonly permissions: readonly string[];
  readonly label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {permissions.map((permission) => (
        <li key={permission}>
          <code className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-sm break-all text-fg">
            {permission}
          </code>
        </li>
      ))}
    </ul>
  );
}

/** "Conflict of duties" (an override of a separation-of-duties rule) or "Sensitive permission". */
export function KindBadge({ kind }: { readonly kind: AuthorisationKind }) {
  const { t } = useTranslation('admin');
  return (
    <Badge
      tone={kind === 'sod_override' ? 'warning' : 'info'}
      label={kind === 'sod_override' ? t('sod.kindConflict') : t('sod.kindSensitive')}
    />
  );
}
