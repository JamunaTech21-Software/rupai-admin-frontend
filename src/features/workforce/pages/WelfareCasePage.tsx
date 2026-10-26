import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Alert, Card, DescriptionList, Link, PageHeader, Stack } from '@/ui';

import { useCase, type WelfareCase } from '../api/benefits';
import { WelfareActions } from '../components/WelfareActions';
import { WelfareForm } from '../components/WelfareForm';

/** HR → Welfare → one case (or a new one): the form while it is a draft, then the money and where it stands. */
export function WelfareCasePage() {
  const { id } = useParams();
  if (id === undefined) return <NewCase />;
  return <ExistingCase id={id} />;
}

function NewCase() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('welfare.newTitle')}
        description={t('welfare.newIntro')}
        breadcrumbs={[{ label: t('welfare.title'), href: '/hr/welfare' }, { label: t('welfare.newTitle') }]}
      />
      <WelfareForm welfareCase={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingCase({ id }: { readonly id: string }) {
  const query = useCase(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <CaseDetail key={`${query.data.id}-${String(query.data.version)}`} welfareCase={query.data} />;
}

function CaseDetail({ welfareCase }: { readonly welfareCase: WelfareCase }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const navigate = useNavigate();
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={welfareCase.case_number}
        status={{
          tone:
            welfareCase.state === 'approved'
              ? 'success'
              : welfareCase.state === 'rejected'
                ? 'danger'
                : 'neutral',
          label: t(`caseStates.${welfareCase.state}`),
        }}
        description={t(`welfareCategories.${welfareCase.welfare_category}`)}
        breadcrumbs={[{ label: t('welfare.title'), href: '/hr/welfare' }, { label: welfareCase.case_number }]}
        actions={
          <WelfareActions
            welfareCase={welfareCase}
            onDeleted={() => {
              void navigate('/hr/welfare', { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      {welfareCase.state === 'submitted' ? (
        <Alert tone="info" title={t('welfare.waitingTitle')}>
          {t('welfare.waitingBody')}{' '}
          {welfareCase.approval_id ? (
            <Link href={`/approvals/${welfareCase.approval_id}`}>{t('welfare.openApproval')}</Link>
          ) : null}
        </Alert>
      ) : null}
      {welfareCase.state === 'rejected' ? (
        <Alert tone="danger" title={t('welfare.rejectedTitle')}>
          {welfareCase.rejection_reason ?? ''}
        </Alert>
      ) : null}
      <WelfareForm welfareCase={welfareCase} onRefused={setRefusal} />
      {welfareCase.state !== 'draft' ? (
        <Card title={t('welfare.money')} headingLevel={2}>
          <DescriptionList
            columns={3}
            items={[
              {
                term: t('welfare.requested'),
                description: welfareCase.requested_amount
                  ? format.money(welfareCase.requested_amount)
                  : t('form.notRecorded'),
              },
              {
                term: t('welfare.approvedAmount'),
                description: welfareCase.approved_amount
                  ? format.money(welfareCase.approved_amount)
                  : t('form.notRecorded'),
              },
              { term: t('welfare.paidSoFar'), description: format.money(welfareCase.disbursed_amount) },
              {
                term: t('welfare.remainingLabel'),
                description: welfareCase.remaining_amount
                  ? format.money(welfareCase.remaining_amount)
                  : t('form.notRecorded'),
              },
              ...(welfareCase.outcome
                ? [{ term: t('welfare.outcome'), description: welfareCase.outcome }]
                : []),
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

export { WelfareCasePage as Component };
