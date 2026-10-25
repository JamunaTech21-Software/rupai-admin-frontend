import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { AttachmentsPanel } from '@/features/documents';
import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { useUrlTab } from '@/lib/urlState';
import { Card, DescriptionList, PageHeader, Stack, Tabs } from '@/ui';

import { usePerson } from '../api/persons';
import { type Person } from '../api/schemas';
import { DependentsPanel } from '../components/DependentsPanel';
import { PersonForm } from '../components/PersonForm';
import { PersonLifecycle } from '../components/PersonLifecycle';

/** Workforce → Persons → one person (or a new one): the personal form, family members, documents, employment. */
export function PersonPage() {
  const { id } = useParams();
  if (id === undefined) return <NewPerson />;
  return <ExistingPerson id={id} />;
}

function NewPerson() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('person.newTitle')}
        description={t('person.newIntro')}
        breadcrumbs={[
          { label: t('person.backToList'), href: '/workforce/persons' },
          { label: t('person.newTitle') },
        ]}
      />
      <PersonForm person={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingPerson({ id }: { readonly id: string }) {
  const query = usePerson(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every save.
  return <PersonDetail key={`${query.data.id}-${String(query.data.version)}`} person={query.data} />;
}

/** Who made the record and when: the design's System Information. */
function SystemInfo({ person }: { readonly person: Person }) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  return (
    <Card title={t('person.sections.system')} headingLevel={2}>
      <DescriptionList
        items={[
          { term: t('person.createdBy'), description: person.created_by.username },
          { term: t('person.createdOn'), description: format.dateTime(person.created_at) },
          {
            term: t('person.updatedOn'),
            description: person.updated_at ? format.dateTime(person.updated_at) : t('person.notRecorded'),
          },
        ]}
      />
    </Card>
  );
}

function PersonDetail({ person }: { readonly person: Person }) {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const canEdit = usePermission('person.edit');
  const canDelete = usePermission('person.delete');
  const tab = useUrlTab('tab', 'personal');
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={person.full_name}
        status={{
          tone: person.status === 'active' ? 'success' : 'neutral',
          label: t(`status.${person.status}`),
        }}
        description={person.person_code}
        breadcrumbs={[
          { label: t('person.backToList'), href: '/workforce/persons' },
          { label: person.full_name },
        ]}
        actions={
          <PersonLifecycle
            person={person}
            canEdit={canEdit}
            canDelete={canDelete}
            onDeleted={() => {
              void navigate('/workforce/persons', { replace: true });
            }}
            onRefused={setRefusal}
          />
        }
      />
      <Tabs
        label={t('person.tabsLabel')}
        {...tab}
        items={[
          {
            id: 'personal',
            label: t('person.tabs.personal'),
            content: (
              <Stack gap={6}>
                <PersonForm person={person} onRefused={setRefusal} />
                <SystemInfo person={person} />
              </Stack>
            ),
          },
          {
            id: 'family',
            label: t('person.tabs.family'),
            count: person.dependent_count,
            content: <DependentsPanel personId={person.id} onRefused={setRefusal} />,
          },
          {
            id: 'documents',
            label: t('person.tabs.documents'),
            content: (
              <Stack gap={6}>
                <AttachmentsPanel owner={{ path: '/persons', id: person.id }} module="person" />
                <Card title={t('person.biometric')} headingLevel={2}>
                  <p className="text-sm text-fg-muted">{t('person.biometricLater')}</p>
                </Card>
              </Stack>
            ),
          },
          {
            id: 'employment',
            label: t('person.tabs.employment'),
            content: (
              <Card title={t('person.sections.employment')} headingLevel={2}>
                <p className="text-sm text-fg-muted">{t('person.employmentLater')}</p>
                <p className="mt-2 text-sm text-fg-muted">{t('person.serviceLater')}</p>
              </Card>
            ),
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

export { PersonPage as Component };
