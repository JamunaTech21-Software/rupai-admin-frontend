import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert, Card, DescriptionList, Link, PageHeader, Stack } from '@/ui';

import { type BalanceProblem, type Leave, useLeave } from '../api/leave';
import { LeaveActions } from '../components/LeaveActions';
import { LeaveForm } from '../components/LeaveForm';

/** HR → Leave → one request (or a new one): the form while it is a draft, then where it stands. */
export function LeaveRequestPage() {
  const { id } = useParams();
  if (id === undefined) return <NewLeave />;
  return <ExistingLeave id={id} />;
}

function NewLeave() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('leave.newTitle')}
        description={t('leave.newIntro')}
        breadcrumbs={[{ label: t('leave.title'), href: '/hr/leave' }, { label: t('leave.newTitle') }]}
      />
      <LeaveForm leave={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingLeave({ id }: { readonly id: string }) {
  const query = useLeave(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <LeaveDetail key={`${query.data.id}-${String(query.data.version)}`} leave={query.data} />;
}

function LeaveDetail({ leave }: { readonly leave: Leave }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const [refusal, setRefusal] = useState<unknown>(null);
  const state: unknown = location.state;
  const problem =
    typeof state === 'object' && state !== null && 'problem' in state
      ? (state.problem as BalanceProblem)
      : null;

  return (
    <Stack gap={6}>
      <PageHeader
        title={leave.request_number}
        status={{
          tone: leave.state === 'approved' ? 'success' : leave.state === 'rejected' ? 'danger' : 'neutral',
          label: t(`leaveStates.${leave.state}`),
        }}
        description={`${leave.profile.full_name} · ${leave.leave_type.name}`}
        breadcrumbs={[{ label: t('leave.title'), href: '/hr/leave' }, { label: leave.request_number }]}
        actions={
          <LeaveActions
            leave={leave}
            onDeleted={() => {
              void navigate('/hr/leave', { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      {leave.state === 'submitted' ? (
        <Alert tone="info" title={t('leave.waitingTitle')}>
          {t('leave.waitingBody')}{' '}
          {leave.approval_id ? (
            <Link href={`/approvals/${leave.approval_id}`}>{t('leave.openApproval')}</Link>
          ) : null}
        </Alert>
      ) : null}
      {leave.state === 'rejected' ? (
        <Alert tone="danger" title={t('leave.rejectedTitle')}>
          {leave.rejection_reason ?? ''}
        </Alert>
      ) : null}
      {leave.state === 'cancelled' ? (
        <Alert tone="info" title={t('leave.cancelledTitle')}>
          {leave.cancellation_reason ?? ''}
        </Alert>
      ) : null}
      <LeaveForm leave={leave} initialProblem={problem} onRefused={setRefusal} />
      {leave.state !== 'draft' ? (
        <Card title={t('leave.summary')} headingLevel={2}>
          <DescriptionList
            columns={3}
            items={[
              { term: t('leave.type'), description: leave.leave_type.name },
              { term: t('leave.columns.days'), description: format.decimal(leave.day_count, 1) },
              { term: t('leave.paid'), description: t(leave.is_paid ? 'leave.yes' : 'leave.no') },
              {
                term: t('leave.balanceNow'),
                description:
                  leave.balance_days === null ? t('form.notRecorded') : format.decimal(leave.balance_days, 1),
              },
              { term: t('leave.covering'), description: leave.covering?.full_name ?? t('form.notRecorded') },
              { term: t('leave.filedBy'), description: leave.created_by.username },
            ]}
          />
        </Card>
      ) : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { LeaveRequestPage as Component };
