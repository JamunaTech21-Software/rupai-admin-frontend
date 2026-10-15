import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { JOB_STATES, type Job } from '@/lib/query';
import { filterKey } from '@/lib/urlState';
import {
  Button,
  ButtonLink,
  Checkbox,
  type DataColumn,
  DataTable,
  EmptyState,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { useJobsList } from '../api/jobs';
import { JobProgress } from '../components/JobProgress';
import { JobStateBadge } from '../components/JobStateBadge';

const ANY = 'any';
const STATE = filterKey('state');
const MINE = filterKey('mine');

/**
 * Jobs (P1.15): work running in the background, newest first. Everyone sees their own; with system.view, everyone's,
 * and "only my jobs" narrows it. Failed jobs are the dead-letter list: open one to see why and to retry it.
 */
export function JobsPage() {
  const { t } = useTranslation('jobs');
  const format = useFormat();
  const canSeeAll = usePermission('system.view');
  const list = useJobsList();
  const { table } = list;

  const columns: DataColumn<Job>[] = [
    {
      id: 'job',
      header: t('columns.job'),
      cell: (job) => (
        <span className="flex flex-col">
          <Link href={`/jobs/${job.id}`}>{job.label}</Link>
          <span className="text-sm text-fg-muted">
            {job.schedule ? t('scheduled', { name: job.schedule }) : job.type}
          </span>
        </span>
      ),
    },
    { id: 'state', header: t('columns.state'), cell: (job) => <JobStateBadge job={job} /> },
    {
      id: 'progress',
      header: t('columns.progress'),
      cell: (job) => (
        <div className="min-w-40">
          <JobProgress job={job} />
        </div>
      ),
    },
    { id: 'queued', header: t('columns.queued'), cell: (job) => format.dateTime(job.queued_at) },
    {
      id: 'finished',
      header: t('columns.finished'),
      canHide: true,
      cell: (job) =>
        job.finished_at ? (
          format.dateTime(job.finished_at)
        ) : (
          <span className="text-fg-muted">{t('notYet')}</span>
        ),
    },
    {
      id: 'started_by',
      header: t('columns.startedBy'),
      canHide: true,
      isHiddenByDefault: true,
      cell: (job) => job.requested_by?.username ?? t('system'),
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canSeeAll ? (
            <ButtonLink href="/admin/schedules" variant="secondary">
              {t('schedules.title')}
            </ButtonLink>
          ) : undefined
        }
      />
      <DataTable
        label={t('title')}
        columns={columns}
        getRowId={(job) => job.id}
        getRowLabel={(job) => job.label}
        storageKey="jobs"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('itemLabel') }}
        toolbar={
          <>
            <Select
              label={t('filters.state')}
              className="w-full sm:w-52"
              value={table.filters[STATE] ?? ANY}
              options={[
                { id: ANY, label: t('filters.anyState') },
                ...JOB_STATES.map((state) => ({ id: state, label: t(`states.${state}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATE, value === null || value === ANY ? null : value);
              }}
            />
            {canSeeAll ? (
              <Checkbox
                isSelected={table.filters[MINE] === 'true'}
                onChange={(on) => {
                  table.setFilter(MINE, on ? 'true' : null);
                }}
              >
                {t('mineOnly')}
              </Checkbox>
            ) : null}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('emptyFilteredTitle')}
              description={t('emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('emptyTitle')} description={t('emptyBody')} />
          )
        }
      />
    </Stack>
  );
}

export { JobsPage as Component };
