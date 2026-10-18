import { PageError, PageLoading } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert, Button, Card, cx, DescriptionList, Link, PageHeader, Stack } from '@/ui';

import { type Check, useHealth } from '../api/health';
import { StatusBadge } from '../components/StatusBadge';

/** Where a check is looked into: the page that has more on it. */
const LINK: Readonly<Record<string, string>> = {
  failed_jobs: '/jobs?filter%5Bstate%5D=failed',
  queue: '/jobs',
  workers: '/admin/schedules',
  scheduler: '/admin/schedules',
  failed_logins: '/admin/audit?tab=access',
};

function CheckCard({ check }: { readonly check: Check }) {
  const { t } = useTranslation('health');
  const href = LINK[check.key];
  const later = check.status === 'not_applicable';
  return (
    <li
      className={cx(
        'flex flex-col gap-2 rounded-lg border border-line bg-surface p-4',
        later && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-heading">{check.label}</h3>
        <StatusBadge status={check.status} />
      </div>
      {check.value ? <p className="text-lg font-medium text-fg figures">{check.value}</p> : null}
      <p className="text-sm text-fg-muted">{check.detail}</p>
      {href && !later ? (
        <Link href={href} className="text-sm">
          {t('look', { label: check.label })}
        </Link>
      ) : null}
    </li>
  );
}

/**
 * Configuration → System health (P1.18, system.view): the overall status first, then one card per check with its
 * status, value and detail, and a link to the page that has more on it. Checks whose source comes in a later phase
 * are grouped under "Later". The report is fetched again every minute, or at once with Refresh.
 */
export function HealthPage() {
  const { t } = useTranslation('health');
  const format = useFormat();
  const query = useHealth();

  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const report = query.data;
  const active = report.checks.filter((check) => check.status !== 'not_applicable');
  const later = report.checks.filter((check) => check.status === 'not_applicable');
  const problems = active.filter((check) => check.status === 'warning' || check.status === 'critical').length;
  const seconds = report.version.uptime_seconds;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const up =
    days > 0
      ? t('uptime.days', { days, hours })
      : hours > 0
        ? t('uptime.hours', { hours, minutes })
        : t('uptime.minutes', { minutes });
  const tone = { ok: 'success', warning: 'warning', critical: 'danger', unknown: 'info' } as const;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('checked', { when: format.dateTime(report.as_of) })}
        actions={
          <Button
            variant="secondary"
            iconStart="refresh"
            isPending={query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            {t('refresh')}
          </Button>
        }
      />
      <Alert tone={tone[report.status]} title={t(`overall.${report.status}`)}>
        {report.status === 'ok'
          ? t('overallBody.ok')
          : report.status === 'unknown'
            ? t('overallBody.unknown')
            : t('overallBody.problems', { count: problems })}
      </Alert>
      <section aria-labelledby="checks-heading" className="flex flex-col gap-3">
        <h2 id="checks-heading" className="text-lg font-semibold text-heading">
          {t('checks')}
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((check) => (
            <CheckCard key={check.key} check={check} />
          ))}
        </ul>
      </section>
      {later.length > 0 ? (
        <section aria-labelledby="later-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="later-heading" className="text-lg font-semibold text-heading">
              {t('later')}
            </h2>
            <p className="text-sm text-fg-muted">{t('laterIntro')}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {later.map((check) => (
              <CheckCard key={check.key} check={check} />
            ))}
          </ul>
        </section>
      ) : null}
      <Card title={t('version.title')} headingLevel={2}>
        <DescriptionList
          columns={3}
          items={[
            { term: t('version.app'), description: report.version.app },
            {
              term: t('version.commit'),
              description: <code className="font-mono text-sm">{report.version.commit}</code>,
            },
            { term: t('version.environment'), description: report.version.environment },
            { term: t('version.node'), description: report.version.node },
            { term: t('version.uptime'), description: up },
            { term: t('version.took'), description: t('version.tookMs', { ms: report.took_ms }) },
          ]}
        />
      </Card>
    </Stack>
  );
}

export { HealthPage as Component };
