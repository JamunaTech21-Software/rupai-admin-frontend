import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { Alert, Link, PageHeader, Stack } from '@/ui';

import { type Program, useProgram } from '../api/training';
import { ParticipantsPanel } from '../components/ParticipantsPanel';
import { ProgramActions } from '../components/ProgramActions';
import { ProgramForm } from '../components/ProgramForm';

/** HR → Training → one programme (or a new one): the form while it is a draft, then its participants and results. */
export function TrainingProgramPage() {
  const { id } = useParams();
  if (id === undefined) return <NewProgram />;
  return <ExistingProgram id={id} />;
}

function NewProgram() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('training.newTitle')}
        description={t('training.newIntro')}
        breadcrumbs={[
          { label: t('training.title'), href: '/hr/training' },
          { label: t('training.newTitle') },
        ]}
      />
      <ProgramForm program={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingProgram({ id }: { readonly id: string }) {
  const query = useProgram(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <ProgramDetail key={`${query.data.id}-${String(query.data.version)}`} program={query.data} />;
}

function ProgramDetail({ program }: { readonly program: Program }) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={program.title}
        status={{
          tone:
            program.state === 'approved' || program.state === 'completed'
              ? 'success'
              : program.state === 'rejected'
                ? 'danger'
                : 'neutral',
          label: t(`programStates.${program.state}`),
        }}
        description={`${program.program_code} · ${program.estate.name}`}
        breadcrumbs={[{ label: t('training.title'), href: '/hr/training' }, { label: program.program_code }]}
        actions={
          <ProgramActions
            program={program}
            onDeleted={() => {
              void navigate('/hr/training', { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      {program.state === 'submitted' ? (
        <Alert tone="info" title={t('training.waitingTitle')}>
          {t('training.waitingBody')}{' '}
          {program.approval_id ? (
            <Link href={`/approvals/${program.approval_id}`}>{t('training.openApproval')}</Link>
          ) : null}
        </Alert>
      ) : null}
      {program.state === 'rejected' ? (
        <Alert tone="danger" title={t('training.rejectedTitle')}>
          {program.rejection_reason ?? ''}
        </Alert>
      ) : null}
      {program.state === 'cancelled' ? (
        <Alert tone="info" title={t('training.cancelledTitle')}>
          {program.cancellation_reason ?? ''}
        </Alert>
      ) : null}
      <ProgramForm program={program} onRefused={setRefusal} />
      <ParticipantsPanel program={program} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { TrainingProgramPage as Component };
