import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState, PageError, PageLoading, RefusalDialog } from '@/features/system';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Alert,
  ButtonLink,
  Button,
  Card,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  Stack,
  StatCard,
  toast,
} from '@/ui';

import {
  type Batch,
  type ErrorLine,
  useBatch,
  useBatchErrors,
  useCancelImport,
  useCommitImport,
} from '../api/imports';
import { BatchStateBadge } from '../components/BatchStateBadge';
import { DownloadButton } from '../components/DownloadButton';

/** A batch being worked on: validated, or saved. The job's own progress, and the reassurance that nothing is lost. */
function Working({ batch }: { readonly batch: Batch }) {
  const { t } = useTranslation('imports');
  const format = useFormat();
  const job = batch.job;
  const known = job !== null && job.progress.total !== null;
  return (
    <Card title={t(batch.state === 'committing' ? 'working.saving' : 'working.checking')} headingLevel={2}>
      <div className="flex flex-col gap-3" aria-live="polite">
        <ProgressBar
          label={t(batch.state === 'committing' ? 'working.saving' : 'working.checking')}
          hideLabel
          {...(job && known ? { value: job.progress.done, maxValue: job.progress.total ?? 100 } : {})}
        />
        {job && job.progress.total !== null ? (
          <p className="text-sm text-fg-muted figures">
            {t('working.rows', {
              done: format.number(job.progress.done),
              total: format.number(job.progress.total),
            })}
          </p>
        ) : null}
        <p className="text-sm text-fg-muted">
          {t(batch.state === 'committing' ? 'working.savingHint' : 'working.checkingHint')}
        </p>
      </div>
    </Card>
  );
}

/** The errors of a batch, one line each: the row (the header is row 1), the column, and what is wrong. */
function ErrorReport({
  batch,
  onRefused,
}: {
  readonly batch: Batch;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('imports');
  const format = useFormat();
  const errors = useBatchErrors(batch.id, true);
  const columns: DataColumn<ErrorLine>[] = [
    { id: 'row', header: t('errors.row'), isNumeric: true, cell: (line) => format.number(line.row_number) },
    { id: 'column', header: t('errors.column'), cell: (line) => line.column ?? '' },
    {
      id: 'code',
      header: t('errors.code'),
      canHide: true,
      cell: (line) => <code className="text-sm">{line.code}</code>,
    },
    { id: 'message', header: t('errors.message'), cell: (line) => line.message },
  ];
  return (
    <Card
      title={t('errors.title')}
      description={t('errors.intro')}
      headingLevel={2}
      actions={
        <span className="flex items-center gap-2">
          <DownloadButton
            path={`/imports/${batch.id}/errors/file`}
            format="xlsx"
            fallbackName={`import-${batch.id}-errors`}
            label={t('errors.report')}
            onRefused={onRefused}
          />
          <DownloadButton
            path={`/imports/${batch.id}/errors/file`}
            format="csv"
            fallbackName={`import-${batch.id}-errors`}
            label={t('errors.report')}
            onRefused={onRefused}
          />
        </span>
      }
    >
      <DataTable
        isPlain
        label={t('errors.lines')}
        columns={columns}
        rows={errors.data ?? []}
        getRowId={(line) => `${String(line.row_number)}-${line.column ?? ''}-${line.code}`}
        getRowLabel={(line) => t('errors.rowLabel', { row: line.row_number })}
        isLoading={errors.isPending}
        error={
          errors.isError
            ? { message: t('errors.failed'), requestId: null, onRetry: () => void errors.refetch() }
            : null
        }
        emptyState={<EmptyState kind="new" title={t('errors.none')} />}
      />
    </Card>
  );
}

/**
 * One import (P1.17), steps 3 to 7, followed from its address so a reload resumes: being checked; refused (the file
 * could not be read: why, and upload again); checked (the counts, the error report, and confirm: only the valid
 * rows are saved); being saved; saved (how many, and the rows refused at the last moment); or cancelled. The buttons
 * are the server's `can_commit` and `can_cancel`.
 */
export function ImportBatchPage() {
  const { id } = useParams();
  const { t } = useTranslation('imports');
  const format = useFormat();
  const query = useBatch(id);
  const commit = useCommitImport({ id: id ?? '' });
  const cancel = useCancelImport({ id: id ?? '' });
  const [confirming, setConfirming] = useState<'commit' | 'cancel' | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  if (id === undefined) return <NotFoundState />;
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const batch = query.data;
  const working = batch.state === 'validating' || batch.state === 'committing';
  const hasErrors = batch.error_count > 0 || batch.failed_count > 0;

  async function run(action: 'commit' | 'cancel') {
    try {
      if (action === 'commit') {
        await commit.mutateAsync();
        toast.success(t('commit.started'));
      } else {
        await cancel.mutateAsync();
        toast.success(t('cancel.done'));
      }
    } catch (error) {
      if (errorBehaviour(error) !== 'conflict') setRefusal(error);
    }
    setConfirming(null);
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title={batch.label}
        description={t('batch.file', { name: batch.file_name })}
        breadcrumbs={[{ label: t('title'), href: '/imports' }, { label: batch.label }]}
        actions={
          <span className="flex flex-wrap items-center gap-3">
            <BatchStateBadge state={batch.state} />
            {batch.can_cancel ? (
              <Button
                variant="secondary"
                onPress={() => {
                  setConfirming('cancel');
                }}
              >
                {t('cancel.button')}
              </Button>
            ) : null}
            {batch.can_commit ? (
              <Button
                onPress={() => {
                  setConfirming('commit');
                }}
              >
                {t('commit.button', { count: batch.valid_count })}
              </Button>
            ) : null}
          </span>
        }
      />

      {working ? <Working batch={batch} /> : null}

      {batch.state === 'rejected' ? (
        <Alert tone="danger" title={t('rejected.title')}>
          <ul className="list-disc ps-5">
            {batch.problems.map((problem) => (
              <li key={`${problem.code}-${problem.message}`}>{problem.message}</li>
            ))}
          </ul>
          <span className="mt-3 block">
            <ButtonLink
              href={`/imports/new?type=${encodeURIComponent(batch.import_type)}`}
              variant="secondary"
            >
              {t('rejected.again')}
            </ButtonLink>
          </span>
        </Alert>
      ) : null}

      {batch.state === 'validated' || batch.state === 'committed' ? (
        <Card title={t('counts.title')} headingLevel={2}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={t('counts.rows')} value={format.number(batch.row_count)} />
            <StatCard label={t('counts.valid')} value={format.number(batch.valid_count)} />
            <StatCard label={t('counts.errors')} value={format.number(batch.error_count)} />
            {batch.state === 'committed' ? (
              <StatCard label={t('counts.committed')} value={format.number(batch.committed_count)} />
            ) : null}
          </div>
        </Card>
      ) : null}

      {batch.state === 'validated' && !batch.can_commit ? (
        <Alert tone="warning" title={t('validated.nothingTitle')}>
          {t('validated.nothingBody')}
        </Alert>
      ) : null}
      {batch.state === 'validated' && batch.can_commit && batch.error_count > 0 ? (
        <Alert tone="info" title={t('validated.someTitle')}>
          {t('validated.someBody', { valid: batch.valid_count, errors: batch.error_count })}
        </Alert>
      ) : null}
      {batch.state === 'committed' ? (
        <Alert
          tone={batch.failed_count > 0 ? 'warning' : 'success'}
          title={t(batch.failed_count > 0 ? 'committed.partialTitle' : 'committed.title', {
            count: batch.committed_count,
          })}
        >
          {batch.failed_count > 0
            ? t('committed.partialBody', { failed: batch.failed_count })
            : t('committed.body')}
        </Alert>
      ) : null}
      {batch.state === 'cancelled' ? (
        <Alert tone="info" title={t('cancelled.title')}>
          {t('cancelled.body')}
        </Alert>
      ) : null}

      {(batch.state === 'validated' || batch.state === 'committed') && hasErrors ? (
        <ErrorReport batch={batch} onRefused={setRefusal} />
      ) : null}

      {batch.state === 'validated' ? (
        <div>
          <ButtonLink href={`/imports/new?type=${encodeURIComponent(batch.import_type)}`} variant="secondary">
            {t('validated.fix')}
          </ButtonLink>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirming === 'commit'}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={t('commit.title', { count: batch.valid_count })}
        consequence={
          batch.error_count > 0 ? t('commit.bodySkipped', { errors: batch.error_count }) : t('commit.body')
        }
        confirmLabel={t('commit.confirm')}
        onConfirm={() => run('commit')}
      />
      <ConfirmDialog
        isOpen={confirming === 'cancel'}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={t('cancel.title', { file: batch.file_name })}
        consequence={t('cancel.body')}
        confirmLabel={t('cancel.confirm')}
        tone="danger"
        onConfirm={() => run('cancel')}
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

export { ImportBatchPage as Component };
