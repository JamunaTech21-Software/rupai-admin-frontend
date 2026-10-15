import { useTranslation } from '@/lib/i18n';
import { jobPercent, type RunningJob, useRunningJobs } from '@/lib/query';
import { Link, Spinner } from '@/ui';

import { useLiveJobs } from '../api/jobs';

/**
 * Background jobs still running, for the top bar (P5 §4.7). It lists the user's live jobs from the server, so a job
 * started before a reload, or in another tab, is found again, and the jobs this tab is following (their progress is
 * fresher). Nothing shows when none run. Clicking opens the job, or the list when there are several. It is a polite
 * status, so screen readers hear when one starts or ends.
 */
export function RunningJobs() {
  const { t } = useTranslation('jobs');
  const followed = useRunningJobs();
  const live = useLiveJobs();

  const byId = new Map<string, RunningJob>();
  for (const job of live.data ?? [])
    byId.set(job.id, { id: job.id, label: job.label, progress: jobPercent(job) });
  for (const job of followed) byId.set(job.id, job);
  const jobs = [...byId.values()];
  const [only] = jobs;

  let text = '';
  let href = '/jobs';
  if (jobs.length === 1 && only) {
    href = `/jobs/${only.id}`;
    text =
      only.progress === null
        ? t('running.one', { label: only.label })
        : t('running.one_progress', { label: only.label, percent: Math.round(only.progress) });
  } else if (jobs.length > 1) {
    text = t('running.many', { count: jobs.length });
  }

  return (
    <div role="status" className="flex items-center gap-2 text-sm text-fg-muted">
      {jobs.length > 0 ? (
        <>
          <Spinner size="sm" label={null} />
          <Link href={href} variant="standalone" className="hidden sm:inline-flex">
            {text}
          </Link>
          <span className="sr-only sm:hidden">{text}</span>
        </>
      ) : null}
    </div>
  );
}
