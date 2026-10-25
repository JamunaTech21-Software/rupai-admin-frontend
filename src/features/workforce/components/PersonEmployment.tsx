import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Button, ButtonLink, Card, DescriptionList, EmptyState, Link, Skeleton } from '@/ui';

import { usePersonProfiles, usePersonServiceSummary } from '../api/profiles';
import { ProfileStatusBadge } from './ProfileActions';

/**
 * A person's page, Employment tab (employment.view): their service totals and every profile they have had, newest
 * first, each a link to the profile; and the way to open one (employment.create).
 */
export function PersonEmployment({ personId }: { readonly personId: string }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('employment.create');
  const canView = usePermission('employment.view');
  const profiles = usePersonProfiles(personId);
  const service = usePersonServiceSummary(personId);
  const rows = profiles.data ?? [];

  if (!canView) return <p className="text-sm text-fg-muted">{t('employment.noAccess')}</p>;

  const days = (value: number | undefined) =>
    value === undefined ? '…' : t('employment.days', { formatted: format.number(value) });

  return (
    <div className="flex flex-col gap-6">
      <Card title={t('employment.serviceTitle')} headingLevel={2}>
        {service.isPending ? (
          <Skeleton variant="table-row" columns={4} rows={1} />
        ) : (
          <DescriptionList
            items={[
              { term: t('employment.profiles'), description: format.number(service.data?.profiles ?? 0) },
              {
                term: t('employment.firstJoined'),
                description: service.data?.first_joining_date
                  ? format.date(service.data.first_joining_date)
                  : t('form.notRecorded'),
              },
              {
                term: t('employment.continuousDays'),
                description: days(service.data?.continuous_service_days),
              },
              { term: t('employment.totalDays'), description: days(service.data?.total_service_days) },
            ]}
          />
        )}
      </Card>
      <Card
        title={t('employment.historyTitle')}
        headingLevel={2}
        {...(canCreate
          ? {
              actions: (
                <ButtonLink href={`/workforce/profiles/new?person=${personId}`} size="sm" iconStart="plus">
                  {t('employment.add')}
                </ButtonLink>
              ),
            }
          : {})}
      >
        {profiles.isPending ? (
          <Skeleton variant="table-row" columns={3} rows={2} />
        ) : profiles.isError ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-danger">{t('employment.failed')}</span>
            <Button size="sm" variant="secondary" onPress={() => void profiles.refetch()}>
              {t('employment.retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState kind="new" title={t('employment.emptyTitle')} description={t('employment.emptyBody')} />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="flex flex-col">
                  <Link href={`/workforce/profiles/${row.id}`} className="font-mono">
                    {row.profile_number}
                  </Link>
                  <span className="text-fg-muted">
                    {t(`employmentTypes.${row.employment_type}`)} · {row.estate.name}
                  </span>
                </span>
                <span className="text-fg-muted">
                  {format.date(row.joining_date)}
                  {row.separation_date ? ` – ${format.date(row.separation_date)}` : ''}
                </span>
                <ProfileStatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
