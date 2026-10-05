import { Icon } from '@/ui';

import { useEnvironment } from '../api/useEnvironment';

const LABEL: Record<string, string> = {
  development: 'Development',
  test: 'Test',
  staging: 'Staging',
};

/**
 * A strip at the top of every page outside production, so nobody mistakes staging for the real system
 * (driven by the backend's X-Environment header). Production shows nothing.
 */
export function EnvironmentBanner() {
  const environment = useEnvironment();
  if (!environment) return null;
  const name = LABEL[environment] ?? environment;

  return (
    <div
      role="note"
      aria-label="Environment"
      className="sticky top-0 z-(--z-banner) flex items-center justify-center gap-2 bg-surface-inverse px-4 py-1 text-sm text-fg-inverse"
    >
      <Icon name="info" size="sm" />
      <span>
        <strong className="font-semibold">{name}</strong> environment: demo data only, not the live system.
      </span>
    </div>
  );
}
