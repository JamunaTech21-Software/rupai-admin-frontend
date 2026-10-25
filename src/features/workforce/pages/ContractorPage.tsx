import { useState } from 'react';
import { useParams } from 'react-router';

import { AttachmentsPanel } from '@/features/documents';
import { ContactsPanel } from '@/features/organisation';
import { PageError, PageLoading, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useUrlTab } from '@/lib/urlState';
import { Alert, Card, DescriptionList, PageHeader, Stack, Tabs } from '@/ui';

import { type Contractor, useContractor } from '../api/contractors';
import { ContractorActions } from '../components/ContractorActions';
import { ContractorForm } from '../components/ContractorForm';
import { ContractsPanel } from '../components/ContractsPanel';

/** Workforce → Contractors → one contractor (or a new one): details, contracts and labour, contacts, documents. */
export function ContractorPage() {
  const { id } = useParams();
  if (id === undefined) return <NewContractor />;
  return <ExistingContractor id={id} />;
}

function NewContractor() {
  const { t } = useTranslation('workforce');
  const [refusal, setRefusal] = useState<unknown>(null);
  return (
    <Stack gap={6}>
      <PageHeader
        title={t('contractor.newTitle')}
        description={t('contractor.newIntro')}
        breadcrumbs={[
          { label: t('contractors.title'), href: '/workforce/contractors' },
          { label: t('contractor.newTitle') },
        ]}
      />
      <ContractorForm contractor={null} onRefused={setRefusal} />
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

function ExistingContractor({ id }: { readonly id: string }) {
  const query = useContractor(id);
  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  // Keyed by version so the form starts again from what the server holds after every change.
  return <ContractorDetail key={`${query.data.id}-${String(query.data.version)}`} contractor={query.data} />;
}

function ContractorDetail({ contractor }: { readonly contractor: Contractor }) {
  const { t } = useTranslation('workforce');
  const canEdit = usePermission('contractor.edit') && contractor.status !== 'blacklisted';
  const canApprove = usePermission('contractor.approve');
  const tab = useUrlTab('tab', 'general');
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={contractor.name}
        status={{
          tone:
            contractor.status === 'active'
              ? 'success'
              : contractor.status === 'blacklisted'
                ? 'danger'
                : 'neutral',
          label: t(`contractorStatus.${contractor.status}`),
        }}
        description={`${contractor.code} · ${t(`contractorTypes.${contractor.contractor_type}`)}`}
        breadcrumbs={[
          { label: t('contractors.title'), href: '/workforce/contractors' },
          { label: contractor.name },
        ]}
        actions={<ContractorActions contractor={contractor} canApprove={canApprove} onRefused={setRefusal} />}
      />
      {contractor.status === 'blacklisted' ? (
        <Alert tone="danger" title={t('contractor.blacklistedTitle')}>
          {contractor.blacklist_reason ?? ''}
        </Alert>
      ) : null}
      <Tabs
        label={t('contractor.tabsLabel')}
        {...tab}
        items={[
          {
            id: 'general',
            label: t('contractor.tabs.general'),
            content: <ContractorForm contractor={contractor} onRefused={setRefusal} />,
          },
          {
            id: 'contracts',
            label: t('contractor.tabs.contracts'),
            content: <ContractsPanel contractor={contractor} onRefused={setRefusal} />,
          },
          {
            id: 'contacts',
            label: t('contractor.tabs.contacts'),
            content: (
              <ContactsPanel
                owner={{ path: 'contractors', id: contractor.id }}
                canEdit={canEdit}
                onRefused={setRefusal}
              />
            ),
          },
          {
            id: 'documents',
            label: t('contractor.tabs.documents'),
            content: (
              <AttachmentsPanel owner={{ path: '/contractors', id: contractor.id }} module="contractor" />
            ),
          },
          {
            id: 'performance',
            label: t('contractor.tabs.performance'),
            content: (
              <Card title={t('contractor.performance')} headingLevel={2}>
                <DescriptionList
                  items={[
                    {
                      term: t('contractor.safety'),
                      description: contractor.safety_compliance
                        ? t(`safetyCompliance.${contractor.safety_compliance}`)
                        : t('form.notRecorded'),
                    },
                    {
                      term: t('contractor.quality'),
                      description: contractor.quality_rating
                        ? t(`qualityRatings.${contractor.quality_rating}`)
                        : t('form.notRecorded'),
                    },
                    { term: t('contractor.onTime'), description: t('contractor.notAvailable') },
                    { term: t('contractor.compliancePct'), description: t('contractor.notAvailable') },
                  ]}
                />
                <p className="mt-3 text-sm text-fg-muted">{t('contractor.performanceLater')}</p>
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

export { ContractorPage as Component };
