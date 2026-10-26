import { useState } from 'react';
import { useParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { Alert, Link, PageHeader, Stack } from '@/ui';

import { type Evaluation, useEvaluation } from '../api/performance';
import { EvaluationAcknowledge } from '../components/EvaluationAcknowledge';
import { EvaluationForm } from '../components/EvaluationForm';

/** HR → Evaluations → one evaluation (or a new one): the form while it is a draft, then read-only until acknowledged. */
export function EvaluationPage() {
  const { id } = useParams();
  if (id === undefined) return <NewEvaluation />;
  return <ExistingEvaluation id={id} />;
}

function NewEvaluation() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('evaluations.newTitle')}
        description={t('evaluations.newIntro')}
        breadcrumbs={[
          { label: t('evaluations.title'), href: '/hr/evaluations' },
          { label: t('evaluations.newTitle') },
        ]}
      />
      <EvaluationForm evaluation={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingEvaluation({ id }: { readonly id: string }) {
  const query = useEvaluation(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <EvaluationDetail key={`${query.data.id}-${String(query.data.version)}`} evaluation={query.data} />;
}

function EvaluationDetail({ evaluation }: { readonly evaluation: Evaluation }) {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={evaluation.profile.full_name}
        status={{
          tone:
            evaluation.state === 'acknowledged'
              ? 'success'
              : evaluation.state === 'rejected'
                ? 'danger'
                : 'neutral',
          label: t(`evaluationStates.${evaluation.state}`),
        }}
        description={`${evaluation.evaluation_number} · ${t(`evaluationTypes.${evaluation.evaluation_type}`)}`}
        breadcrumbs={[
          { label: t('evaluations.title'), href: '/hr/evaluations' },
          { label: evaluation.evaluation_number },
        ]}
      />
      {evaluation.state === 'submitted' ? (
        <Alert tone="info" title={t('evaluations.waitingTitle')}>
          {t('evaluations.waitingBody')}{' '}
          {evaluation.approval_id ? (
            <Link href={`/approvals/${evaluation.approval_id}`}>{t('evaluations.openApproval')}</Link>
          ) : null}
        </Alert>
      ) : null}
      {evaluation.state === 'rejected' ? (
        <Alert tone="danger" title={t('evaluations.rejectedTitle')}>
          {evaluation.rejection_reason ?? ''}
        </Alert>
      ) : null}
      {evaluation.is_locked ? (
        <Alert tone="info" title={t('evaluations.lockedTitle')}>
          {t('evaluations.lockedBody')}
        </Alert>
      ) : null}
      <EvaluationForm evaluation={evaluation} onRefused={setRefusal} />
      <EvaluationAcknowledge evaluation={evaluation} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { EvaluationPage as Component };
