import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useUrlTab } from '@/lib/urlState';
import { PageHeader, Stack, Tabs } from '@/ui';

import { useProfile } from '../api/profiles';
import { EMPLOYMENT_TYPES, type Profile } from '../api/profileSchemas';
import { AssignmentsPanel } from '../components/AssignmentsPanel';
import { ProfileActions } from '../components/ProfileActions';
import { ProfileForm } from '../components/ProfileForm';

/** Workforce → a profile (or a new one): pick the person, set the employment; separate, suspend or delete it. */
export function ProfilePage() {
  const { id } = useParams();
  if (id === undefined) return <NewProfile />;
  return <ExistingProfile id={id} />;
}

function NewProfile() {
  const { t } = useTranslation('workforce');
  const [params] = useSearchParams();
  const [refusal, setRefusal] = useState<unknown>(null);
  const type = EMPLOYMENT_TYPES.find((value) => value === params.get('type'));
  const personId = params.get('person') ?? undefined;
  const list =
    type === 'employee'
      ? '/workforce/employees'
      : type === 'worker'
        ? '/workforce/workers'
        : '/workforce/profiles';
  return (
    <Stack gap={6}>
      <PageHeader
        title={t(`form.newTitle.${type ?? 'any'}`)}
        description={t('form.newIntro')}
        breadcrumbs={[
          { label: t(`profiles.title.${type ?? 'any'}`), href: list },
          { label: t(`form.newTitle.${type ?? 'any'}`) },
        ]}
      />
      <ProfileForm profile={null} initialType={type} initialPersonId={personId} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingProfile({ id }: { readonly id: string }) {
  const query = useProfile(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <ProfileDetail key={`${query.data.id}-${String(query.data.version)}`} profile={query.data} />;
}

function ProfileDetail({ profile }: { readonly profile: Profile }) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const canEdit = usePermission('employment.edit');
  const canApprove = usePermission('employment.approve');
  const canDelete = usePermission('employment.delete');
  const tab = useUrlTab('tab', 'employment');
  const [refusal, setRefusal] = useState<unknown>(null);
  const list = profile.employment_type === 'worker' ? '/workforce/workers' : '/workforce/employees';

  return (
    <Stack gap={6}>
      <PageHeader
        title={profile.person.full_name}
        status={{
          tone: profile.status === 'active' ? 'success' : 'neutral',
          label: t(`profileStatus.${profile.status}`),
        }}
        description={`${profile.profile_number} · ${t(`employmentTypes.${profile.employment_type}`)}`}
        breadcrumbs={[
          { label: t(`profiles.title.${profile.employment_type}`), href: list },
          { label: profile.person.full_name },
        ]}
        actions={
          <ProfileActions
            profile={profile}
            canEdit={canEdit}
            canApprove={canApprove}
            canDelete={canDelete}
            onDeleted={() => {
              void navigate(list, { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      <Tabs
        label={t('form.tabsLabel')}
        {...tab}
        items={[
          {
            id: 'employment',
            label: t('form.tabs.employment'),
            content: <ProfileForm profile={profile} onRefused={setRefusal} />,
          },
          {
            id: 'assignments',
            label: t('form.tabs.assignments'),
            content: <AssignmentsPanel profile={profile} onRefused={setRefusal} />,
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

export { ProfilePage as Component };
