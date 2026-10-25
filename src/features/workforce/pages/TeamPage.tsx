import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useUrlTab } from '@/lib/urlState';
import { PageHeader, Stack, Tabs } from '@/ui';

import { type Team, useTeam } from '../api/teams';
import { MembersPanel } from '../components/MembersPanel';
import { TeamForm } from '../components/TeamForm';
import { TeamLifecycle } from '../components/TeamLifecycle';

/** Workforce → Teams → one team (or a new one): its details, and who is in it and when. */
export function TeamPage() {
  const { id } = useParams();
  if (id === undefined) return <NewTeam />;
  return <ExistingTeam id={id} />;
}

function NewTeam() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('team.newTitle')}
        description={t('team.newIntro')}
        breadcrumbs={[{ label: t('teams.title'), href: '/workforce/teams' }, { label: t('team.newTitle') }]}
      />
      <TeamForm team={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingTeam({ id }: { readonly id: string }) {
  const query = useTeam(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <TeamDetail key={`${query.data.id}-${String(query.data.version)}`} team={query.data} />;
}

function TeamDetail({ team }: { readonly team: Team }) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const canEdit = usePermission('team.edit');
  const canDelete = usePermission('team.delete');
  const tab = useUrlTab('tab', 'members');
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={team.name}
        status={{
          tone: team.status === 'active' ? 'success' : 'neutral',
          label: t(`status.${team.status}`),
        }}
        description={`${team.code} · ${t(`teamTypes.${team.team_type}`)}`}
        breadcrumbs={[{ label: t('teams.title'), href: '/workforce/teams' }, { label: team.name }]}
        actions={
          <TeamLifecycle
            team={team}
            canEdit={canEdit}
            canDelete={canDelete}
            onDeleted={() => {
              void navigate('/workforce/teams', { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      <Tabs
        label={t('team.tabsLabel')}
        {...tab}
        items={[
          {
            id: 'members',
            label: t('team.tabs.members'),
            count: team.member_count,
            content: <MembersPanel team={team} onRefused={setRefusal} />,
          },
          {
            id: 'details',
            label: t('team.tabs.details'),
            content: <TeamForm team={team} onRefused={setRefusal} />,
          },
        ]}
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

export { TeamPage as Component };
