import { useFormat, useTranslation } from '@/lib/i18n';
import { Card, Link, StatCard } from '@/ui';

import { ENGAGEMENT_TYPES, type Bucket, type WorkforceSummary } from '../api/profileSchemas';
import { GENDERS } from '../api/schemas';

const AGE_GROUPS = ['under_25', '25_35', '35_45', '45_55', '55_plus'] as const;
const SERVICE_GROUPS = ['0_1', '1_3', '3_5', '5_10', '10_plus'] as const;

/** The headline cards of Worker / Employee Management: total, active, on leave, separated, new, average tenure. */
export function SummaryCards({
  summary,
  noun,
}: {
  readonly summary: WorkforceSummary | undefined;
  /** "workers" or "employees", for the labels. */
  readonly noun: 'workers' | 'employees' | 'people';
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const n = (value: number | undefined) => (value === undefined ? '…' : format.number(value));
  const pct = (value: string | undefined) => (value === undefined ? '' : `${format.decimal(value, 2)}%`);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label={t(`overview.total.${noun}`)} value={n(summary?.total)} />
      <StatCard
        label={t(`overview.active.${noun}`)}
        value={n(summary?.active)}
        {...(summary ? { unit: pct(summary.active_pct) } : {})}
      />
      <StatCard
        label={t('overview.onLeave')}
        value={n(summary?.on_leave)}
        {...(summary ? { unit: pct(summary.on_leave_pct) } : {})}
      />
      <StatCard label={t('overview.separated')} value={n(summary?.separated)} />
      <StatCard label={t('overview.newThisMonth')} value={n(summary?.new_this_month)} />
      <StatCard
        label={t('overview.averageTenure')}
        value={
          summary === undefined
            ? '…'
            : summary.average_tenure_years === null
              ? '—'
              : format.decimal(summary.average_tenure_years, 1)
        }
        unit={t('overview.years')}
      />
    </div>
  );
}

/** One breakdown as labelled bars; the widest bar is the largest group. */
function Breakdown({
  title,
  buckets,
  label,
}: {
  readonly title: string;
  readonly buckets: readonly Bucket[];
  readonly label: (bucket: Bucket) => string;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const largest = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <Card title={title} headingLevel={2}>
      {buckets.every((bucket) => bucket.count === 0) ? (
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
              <span className="font-medium text-fg figures">{format.number(bucket.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The design's charts: by category, department, engagement type, gender, age group and length of service. */
export function Breakdowns({ summary }: { readonly summary: WorkforceSummary }) {
  const { t } = useTranslation('workforce');
  /** The server's own name (a category or department comes from the masters), with "not set" translated. */
  const serverName = (bucket: Bucket) => (bucket.key === 'none' ? t('overview.notSet') : bucket.label);
  /** A fixed group (engagement type, gender, age, service) is named by its key in the user's language. */
  const engagement = (bucket: Bucket) => {
    const key = ENGAGEMENT_TYPES.find((value) => value === bucket.key);
    return key ? t(`engagement.${key}`) : bucket.label;
  };
  const gender = (bucket: Bucket) => {
    const key = GENDERS.find((value) => value === bucket.key);
    return key ? t(`genders.${key}`) : bucket.label;
  };
  const age = (bucket: Bucket) => {
    const key = AGE_GROUPS.find((value) => value === bucket.key);
    return key ? t(`ageGroups.${key}`) : bucket.label;
  };
  const service = (bucket: Bucket) => {
    const key = SERVICE_GROUPS.find((value) => value === bucket.key);
    return key ? t(`serviceGroups.${key}`) : bucket.label;
  };
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Breakdown title={t('overview.byCategory')} buckets={summary.by_category} label={serverName} />
      <Breakdown title={t('overview.byDepartment')} buckets={summary.by_department} label={serverName} />
      <Breakdown title={t('overview.byEngagement')} buckets={summary.by_engagement_type} label={engagement} />
      <Breakdown title={t('overview.byGender')} buckets={summary.by_gender} label={gender} />
      <Breakdown title={t('overview.byAge')} buckets={summary.by_age_group} label={age} />
      <Breakdown title={t('overview.byService')} buckets={summary.by_length_of_service} label={service} />
    </div>
  );
}

/** The design's Birthday / Anniversary tab: this month, in day order, each a link to the profile. */
export function Celebrations({ summary }: { readonly summary: WorkforceSummary }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const list = (
    rows: readonly { profile_id: string; full_name: string; date: string; years?: number }[],
    empty: string,
  ) =>
    rows.length === 0 ? (
      <p className="text-sm text-fg-muted">{empty}</p>
    ) : (
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <li key={`${row.profile_id}-${row.date}`} className="flex items-baseline justify-between gap-3">
            <Link href={`/workforce/profiles/${row.profile_id}`}>{row.full_name}</Link>
            <span className="text-fg-muted">
              {format.date(row.date)}
              {row.years === undefined ? '' : ` · ${t('overview.yearsOfService', { years: row.years })}`}
            </span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card title={t('overview.birthdays')} headingLevel={2}>
        {list(summary.birthdays_this_month, t('overview.noBirthdays'))}
      </Card>
      <Card title={t('overview.anniversaries')} headingLevel={2}>
        {list(summary.anniversaries_this_month, t('overview.noAnniversaries'))}
      </Card>
    </div>
  );
}
