import { PageError } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Card, Icon, type IconName, Skeleton } from '@/ui';

import { useEstateSummary } from '../api/estateProfile';
import { useArea } from '../area';

/**
 * The estate at a glance (R.2): figures the server works out from the estate's records (GET /estates/{id}/summary).
 * They are read-only by design: changing a division or a field changes them. Areas in acres.
 */
export function EstateOverview({ estateId }: { readonly estateId: string }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const area = useArea();
  const summary = useEstateSummary(estateId);

  const body = (() => {
    if (summary.isPending) return <Skeleton variant="text" lines={8} />;
    if (summary.isError) return <PageError error={summary.error} onRetry={() => void summary.refetch()} />;
    const s = summary.data;
    const workforce = (count: number) => (s.workforce_available ? format.number(count) : t('profile.withHr'));
    const rows: { icon: IconName; label: string; value: string }[] = [
      {
        icon: 'map',
        label: t('profile.totalArea'),
        value: s.total_land_area ? area.format(s.total_land_area) : t('profile.notDeclared'),
      },
      { icon: 'leaf', label: t('profile.teaArea'), value: area.format(s.tea_area) },
      {
        icon: 'map',
        label: t('profile.nonTeaArea'),
        value: s.non_tea_area ? area.format(s.non_tea_area) : t('profile.notDeclared'),
      },
      { icon: 'folderOpen', label: t('profile.divisions'), value: format.number(s.division_count) },
      { icon: 'columns', label: t('profile.sections'), value: format.number(s.section_count) },
      { icon: 'mapPin', label: t('profile.fields'), value: format.number(s.field_count) },
      { icon: 'factory', label: t('profile.factories'), value: format.number(s.factory_count) },
      { icon: 'users', label: t('profile.workers'), value: workforce(s.worker_count) },
      { icon: 'home', label: t('profile.families'), value: workforce(s.family_count) },
      { icon: 'file', label: t('profile.photos'), value: format.number(s.photo_count) },
    ];
    return (
      <dl className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2">
            <dt className="flex items-center gap-3 text-sm text-fg">
              <Icon name={row.icon} size="sm" className="text-fg-subtle" />
              {row.label}
            </dt>
            <dd className="text-end text-sm font-semibold text-primary figures">{row.value}</dd>
          </div>
        ))}
      </dl>
    );
  })();

  return (
    <Card title={t('profile.overview')} description={t('profile.overviewIntro')} headingLevel={2}>
      {body}
    </Card>
  );
}
