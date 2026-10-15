import { useFormat, useTranslation } from '@/lib/i18n';
import { type Job, jobPercent } from '@/lib/query';
import { ProgressBar } from '@/ui';

/**
 * How far a job has got: a bar, with "4 of 10" under it when the total is known and "4 done" when it is not. A
 * running job without a total shows a bar that only moves. A finished job's bar is full when it completed and stops
 * where it stopped otherwise (red for a failure, amber for a partial result). The bar's name is the job's, read out
 * but not shown again: the page already names the job.
 */
export function JobProgress({ job }: { readonly job: Pick<Job, 'label' | 'state' | 'progress'> }) {
  const { t } = useTranslation('jobs');
  const format = useFormat();
  const { done, total } = job.progress;
  const percent = jobPercent(job);
  const text =
    total === null
      ? t('progressDone', { done: format.number(done) })
      : t('progressOf', { done: format.number(done), total: format.number(total) });

  // Without a total only a running job has a bar (an indeterminate one); a stopped one has just its count.
  if (percent === null && job.state !== 'running')
    return <span className="text-sm text-fg-muted">{text}</span>;
  return (
    <div className="flex flex-col gap-1">
      <ProgressBar
        label={job.label}
        hideLabel
        {...(percent === null ? {} : { value: done, maxValue: total ?? 100 })}
        tone={job.state === 'failed' ? 'danger' : job.state === 'partial' ? 'warning' : 'primary'}
      />
      <span className="text-sm text-fg-muted figures">{text}</span>
    </div>
  );
}
