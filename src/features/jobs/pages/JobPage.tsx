import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState, PageError, PageLoading, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { isJobRetrying, useJob } from '@/lib/query';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  type DescriptionItem,
  DescriptionList,
  PageHeader,
  Stack,
  toast,
} from '@/ui';

import { useRetryJob } from '../api/jobs';
import { JobProgress } from '../components/JobProgress';
import { JobResult } from '../components/JobResult';
import { JobStateBadge } from '../components/JobStateBadge';

/**
 * One job (P1.15), followed live: it polls with backoff until the job ends and then stops. Nothing blocks the user,
 * and the job keeps running when they leave. A failed job shows why and can be retried (system.edit); a job waiting
 * to retry says when; a partly done one points at its report.
 */
export function JobPage() {
  const { id } = useParams();
  const { t } = useTranslation('jobs');
  const format = useFormat();
  const query = useJob(id ?? null);
  const canRetry = usePermission('system.edit');
  const retry = useRetryJob({ id: id ?? '' });
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  if (id === undefined) return <NotFoundState />;
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const job = query.data;
  const when = (value: string | null) => (value ? format.dateTime(value) : t('notYet'));

  const items: DescriptionItem[] = [
    { term: t('detail.type'), description: <code className="font-mono text-sm">{job.type}</code> },
    { term: t('detail.startedBy'), description: job.requested_by?.username ?? t('system') },
    ...(job.schedule ? [{ term: t('detail.schedule'), description: job.schedule }] : []),
    { term: t('detail.queuedAt'), description: format.dateTime(job.queued_at) },
    { term: t('detail.startedAt'), description: when(job.started_at) },
    { term: t('detail.finishedAt'), description: when(job.finished_at) },
    {
      term: t('detail.attempts'),
      description: t('detail.attemptsOf', { attempts: job.attempts, max: job.max_attempts }),
    },
    ...(job.expires_at
      ? [{ term: t('detail.expiresAt'), description: format.dateTime(job.expires_at) }]
      : []),
  ];

  const status = (() => {
    if (job.state === 'failed')
      return (
        <Alert tone="danger" title={t('detail.errorTitle')}>
          {job.error ? (
            <>
              <span className="block">{job.error.message}</span>
              <span className="block text-sm">{t('detail.errorCode', { code: job.error.code })}</span>
            </>
          ) : null}
        </Alert>
      );
    if (isJobRetrying(job))
      return (
        <Alert tone="warning" title={t('detail.retryingTitle')}>
          <span className="block">
            {t('detail.retryingBody', {
              attempts: job.attempts,
              max: job.max_attempts,
              when: job.next_attempt_at ? format.dateTime(job.next_attempt_at) : t('notYet'),
            })}
          </span>
          {job.error ? (
            <span className="block text-sm">{t('detail.lastError', { message: job.error.message })}</span>
          ) : null}
        </Alert>
      );
    if (job.state === 'partial')
      return (
        <Alert tone="warning" title={t('detail.partialTitle')}>
          {t('detail.partialBody')}
        </Alert>
      );
    return null;
  })();

  return (
    <Stack gap={6}>
      <PageHeader
        title={job.label}
        description={t('detail.keepsRunning')}
        breadcrumbs={[{ label: t('detail.back'), href: '/jobs' }, { label: job.label }]}
        actions={
          <span className="flex flex-wrap items-center gap-3">
            <JobStateBadge job={job} />
            {canRetry && job.state === 'failed' ? (
              <Button
                iconStart="refresh"
                onPress={() => {
                  setConfirming(true);
                }}
              >
                {t('detail.retry')}
              </Button>
            ) : null}
          </span>
        }
      />
      {status}
      <Card title={t('columns.progress')} headingLevel={2}>
        <JobProgress job={job} />
      </Card>
      <Card title={t('detail.details')} headingLevel={2}>
        <DescriptionList items={items} columns={2} />
      </Card>
      {job.result ? (
        <Card title={t('detail.result')} headingLevel={2}>
          <JobResult result={job.result} />
        </Card>
      ) : null}
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t('detail.retryTitle', { label: job.label })}
        consequence={t('detail.retryBody')}
        confirmLabel={t('detail.retryButton')}
        onConfirm={async () => {
          try {
            await retry.mutateAsync();
            toast.success(t('detail.retried'));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') setRefusal(error);
          }
          setConfirming(false);
        }}
      />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { JobPage as Component };
