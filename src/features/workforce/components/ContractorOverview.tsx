import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Card, Link, StatCard } from '@/ui';

import {
  CONTRACTOR_STATUSES,
  CONTRACTOR_TYPES,
  type ContractorBucket,
  type ContractorSummary,
  WORK_TYPES,
} from '../api/contractors';

/** The cards of Contractor Management: total, active, inactive, contracts expiring, new this month, contract value. */
export function ContractorCards({ summary }: { readonly summary: ContractorSummary | undefined }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const n = (value: number | undefined) => (value === undefined ? '…' : format.number(value));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label={t('contractors.cards.total')} value={n(summary?.total)} />
      <StatCard label={t('contractors.cards.active')} value={n(summary?.active)} />
      <StatCard label={t('contractors.cards.inactive')} value={n(summary?.inactive)} />
      <StatCard
        label={t('contractors.cards.expiring', { days: summary?.expiring_days ?? 30 })}
        value={n(summary?.contracts_expiring)}
      />
      <StatCard label={t('contractors.cards.newThisMonth')} value={n(summary?.new_this_month)} />
      <StatCard
        label={t('contractors.cards.value')}
        value={summary ? format.money(summary.total_contract_value) : '…'}
        className="min-w-0 [&_.figures]:text-xl"
      />
    </div>
  );
}

/** One breakdown as labelled bars with their share. */
function Breakdown({
  title,
  buckets,
  label,
}: {
  readonly title: string;
  readonly buckets: readonly ContractorBucket[];
  readonly label: (bucket: ContractorBucket) => string;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const largest = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <Card title={title} headingLevel={2}>
      {buckets.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('overview.nothingYet')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {buckets.map((bucket) => (
            <li
              key={bucket.key}
              className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm"
            >
              <span className="truncate text-fg-muted">{label(bucket)}</span>
              <span aria-hidden="true" className="h-2 rounded-full bg-surface-subtle">
                <span
                  className="block h-2 rounded-full bg-primary"
                  style={{ width: `${String((bucket.count / largest) * 100)}%` }}
                />
              </span>
              <span className="font-medium text-fg figures">
                {format.number(bucket.count)} · {format.decimal(bucket.percentage, 0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The design's charts (by type, work type, trade category and status) and the alerts under them. */
export function ContractorBreakdowns({ summary }: { readonly summary: ContractorSummary }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const type = (bucket: ContractorBucket) => {
    const key = CONTRACTOR_TYPES.find((value) => value === bucket.key);
    return key ? t(`contractorTypes.${key}`) : bucket.label;
  };
  const work = (bucket: ContractorBucket) => {
    const key = WORK_TYPES.find((value) => value === bucket.key);
    return key ? t(`workTypes.${key}`) : bucket.key === 'none' ? t('overview.notSet') : bucket.label;
  };
  const trade = (bucket: ContractorBucket) => (bucket.key === 'none' ? t('overview.notSet') : bucket.label);
  const status = (bucket: ContractorBucket) => {
    const key = CONTRACTOR_STATUSES.find((value) => value === bucket.key);
    return key ? t(`contractorStatus.${key}`) : bucket.label;
  };
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Breakdown title={t('contractors.byType')} buckets={summary.by_contractor_type} label={type} />
        <Breakdown title={t('contractors.byWork')} buckets={summary.by_work_type} label={work} />
        <Breakdown title={t('contractors.byTrade')} buckets={summary.by_trade_category} label={trade} />
        <Breakdown title={t('contractors.byStatus')} buckets={summary.by_status} label={status} />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title={t('contractors.alerts')} headingLevel={2}>
          {summary.expiry_alerts.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('contractors.noAlerts')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {summary.expiry_alerts.map((alert) => (
                <li
                  key={alert.contract_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="flex flex-col">
                    <Link href={`/workforce/contractors/${alert.contractor_id}?tab=contracts`}>
                      {alert.contractor_name}
                    </Link>
                    <span className="text-fg-muted">
                      <span className="font-mono">{alert.contract_number}</span> ·{' '}
                      {format.date(alert.end_date)}
                    </span>
                  </span>
                  <Badge
                    tone={
                      alert.status === 'safe' ? 'neutral' : alert.status === 'expired' ? 'danger' : 'warning'
                    }
                    label={t(`contractors.alertStatus.${alert.status}`, { count: alert.days_left })}
                  />
                </li>
              ))}
            </ul>
          )}
          {summary.licences_expiring > 0 ? (
            <p className="mt-3 text-sm text-warning">
              {t('contractors.licencesExpiring', { count: summary.licences_expiring })}
            </p>
          ) : null}
        </Card>
        <Card title={t('contractors.top')} headingLevel={2}>
          {summary.top_contractors.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('overview.nothingYet')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {summary.top_contractors.map((row) => (
                <li key={row.contractor_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/workforce/contractors/${row.contractor_id}`}>{row.name}</Link>
                  <span className="font-medium text-fg figures">{format.money(row.contract_value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
