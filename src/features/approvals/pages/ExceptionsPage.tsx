import { describeError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { type DataColumn, DataTable, EmptyState, Link, PageHeader, Stack } from '@/ui';

import { type Approval } from '../api/approvals';
import { useApprovalExceptions } from '../api/delegations';

/** The step an exception waits on, and who would have to be given the role for it to move. */
function waitingStep(approval: Approval) {
  return approval.steps.find((step) => step.step_number === approval.current_step_number);
}

/**
 * Approval exceptions (P1.14, workflow.view): pending approvals whose current step resolves to nobody. The engine
 * never skips such a step; the way out is to give someone the role (a temporary grant will do), and the approval then
 * leaves this list.
 */
export function ExceptionsPage() {
  const { t } = useTranslation('approvals');
  const format = useFormat();
  const query = useApprovalExceptions();

  const columns: DataColumn<Approval>[] = [
    {
      id: 'document',
      header: t('columns.document'),
      cell: (approval) => (
        <span className="flex flex-col">
          <Link href={`/approvals/${approval.id}`}>
            {approval.document_number ?? approval.document_label}
          </Link>
          <span className="text-sm text-fg-muted">{approval.document_type_label}</span>
        </span>
      ),
    },
    {
      id: 'step',
      header: t('columns.step'),
      cell: (approval) => {
        const step = waitingStep(approval);
        return step?.name ? `${String(step.step_number)} · ${step.name}` : String(step?.step_number ?? '');
      },
    },
    {
      id: 'needs',
      header: t('exceptions.needs'),
      cell: (approval) => {
        const step = waitingStep(approval);
        return step?.role
          ? t('exceptions.needsRole', { role: step.role.name })
          : t('exceptions.needsResolving');
      },
    },
    {
      id: 'submitted_at',
      header: t('columns.submittedAt'),
      canHide: true,
      cell: (approval) => format.dateTime(approval.submitted_at),
    },
  ];

  const failure = query.isError ? describeError(query.error) : null;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('exceptions.title')}
        description={t('exceptions.description')}
        breadcrumbs={[{ label: t('title'), href: '/approvals' }, { label: t('exceptions.title') }]}
      />
      <DataTable
        label={t('exceptions.title')}
        columns={columns}
        rows={query.data ?? []}
        getRowId={(approval) => approval.id}
        getRowLabel={(approval) => approval.document_number ?? approval.document_label}
        isLoading={query.isPending}
        error={
          failure
            ? {
                message: failure.message,
                requestId: failure.requestId,
                onRetry: () => {
                  void query.refetch();
                },
              }
            : null
        }
        emptyState={
          <EmptyState kind="new" title={t('exceptions.emptyTitle')} description={t('exceptions.emptyBody')} />
        }
      />
    </Stack>
  );
}

export { ExceptionsPage as Component };
