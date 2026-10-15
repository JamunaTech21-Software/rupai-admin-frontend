import { useTranslation } from '@/lib/i18n';
import { type Job, isJobRetrying } from '@/lib/query';
import { Badge, type BadgeTone } from '@/ui';

const TONE: Record<Job['state'], BadgeTone> = {
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'danger',
};

/** Where a job stands, in words and colour. A queued job that already failed once says it is retrying. */
export function JobStateBadge({ job }: { readonly job: Pick<Job, 'state' | 'attempts'> }) {
  const { t } = useTranslation('jobs');
  const retrying = isJobRetrying(job);
  return (
    <Badge
      tone={retrying ? 'warning' : TONE[job.state]}
      label={t(`states.${retrying ? 'retrying' : job.state}`)}
    />
  );
}
