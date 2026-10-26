import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { Alert, Link, PageHeader, Stack } from '@/ui';

import { type Goal, useGoal } from '../api/performance';
import { GoalActions } from '../components/GoalActions';
import { GoalForm } from '../components/GoalForm';
import { GoalProgress } from '../components/GoalProgress';

/** HR → Goals → one goal (or a new one): the form while it is a draft, then its progress. */
export function GoalPage() {
  const { id } = useParams();
  if (id === undefined) return <NewGoal />;
  return <ExistingGoal id={id} />;
}

function NewGoal() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('goals.newTitle')}
        description={t('goals.newIntro')}
        breadcrumbs={[{ label: t('goals.title'), href: '/hr/goals' }, { label: t('goals.newTitle') }]}
      />
      <GoalForm goal={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingGoal({ id }: { readonly id: string }) {
  const query = useGoal(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <GoalDetail key={`${query.data.id}-${String(query.data.version)}`} goal={query.data} />;
}

function GoalDetail({ goal }: { readonly goal: Goal }) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={goal.title}
        status={{
          tone:
            goal.state === 'completed'
              ? 'success'
              : goal.state === 'overdue' || goal.state === 'rejected'
                ? 'danger'
                : 'neutral',
          label: t(`goalStates.${goal.state}`),
        }}
        description={`${goal.goal_code} · ${goal.owner_name ?? ''}`}
        breadcrumbs={[{ label: t('goals.title'), href: '/hr/goals' }, { label: goal.goal_code }]}
        actions={
          <GoalActions
            goal={goal}
            onDeleted={() => {
              void navigate('/hr/goals', { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      {goal.state === 'submitted' ? (
        <Alert tone="info" title={t('goals.waitingTitle')}>
          {t('goals.waitingBody')}{' '}
          {goal.approval_id ? (
            <Link href={`/approvals/${goal.approval_id}`}>{t('goals.openApproval')}</Link>
          ) : null}
        </Alert>
      ) : null}
      {goal.state === 'rejected' ? (
        <Alert tone="danger" title={t('goals.rejectedTitle')}>
          {goal.rejection_reason ?? ''}
        </Alert>
      ) : null}
      {goal.state === 'cancelled' ? (
        <Alert tone="info" title={t('goals.cancelledTitle')}>
          {goal.cancellation_reason ?? ''}
        </Alert>
      ) : null}
      <GoalForm goal={goal} onRefused={setRefusal} />
      {goal.state !== 'draft' ? <GoalProgress goal={goal} onRefused={setRefusal} /> : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { GoalPage as Component };
