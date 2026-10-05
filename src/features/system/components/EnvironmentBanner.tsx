import { useTranslation } from '@/lib/i18n';
import { Icon } from '@/ui';

import { useEnvironment } from '../api/useEnvironment';

/**
 * A strip at the top of every page outside production, so nobody mistakes staging for the real system
 * (driven by the backend's X-Environment header). Production shows nothing.
 */
export function EnvironmentBanner() {
  const { t } = useTranslation('system');
  const environment = useEnvironment();
  if (!environment) return null;
  const known = ['development', 'test', 'staging'] as const;
  const name = (known as readonly string[]).includes(environment)
    ? t(`environments.${environment as (typeof known)[number]}`)
    : environment;

  return (
    <div
      role="note"
      aria-label={t('home:environment')}
      className="sticky top-0 z-(--z-banner) flex items-center justify-center gap-2 bg-surface-inverse px-4 py-1 text-sm text-fg-inverse"
    >
      <Icon name="info" size="sm" />
      <span>{t('environmentBanner', { environment: name })}</span>
    </div>
  );
}
