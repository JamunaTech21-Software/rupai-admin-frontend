import { useTranslation } from '@/lib/i18n';
import { useRunningJobs } from '@/lib/query';
import { Spinner } from '@/ui';

/**
 * Background jobs still running in this tab (exports, imports, payroll runs), for the top bar (Spec P5 §4.5).
 * Nothing shows when none are running. It is a polite status, so screen readers hear when one starts or ends.
 */
export function RunningJobs() {
  const { t } = useTranslation('system');
  const jobs = useRunningJobs();
  const [only] = jobs;
  let text = '';
  if (jobs.length === 1 && only) {
    text = only.progress === null ? only.label : `${only.label} (${String(Math.round(only.progress))}%)`;
  } else if (jobs.length > 1) {
    text = t('jobsRunning', { count: jobs.length });
  }

  return (
    <div role="status" className="flex items-center gap-2 text-sm text-fg-muted">
      {jobs.length > 0 ? (
        <>
          <Spinner size="sm" label={null} />
          <span className="hidden sm:inline">{text}</span>
          <span className="sr-only sm:hidden">{text}</span>
        </>
      ) : null}
    </div>
  );
}
