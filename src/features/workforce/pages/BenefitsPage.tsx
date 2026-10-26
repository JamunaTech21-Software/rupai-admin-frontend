import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useUrlTab } from '@/lib/urlState';
import { Button, PageHeader, Stack, Tabs } from '@/ui';

import { RefusalDialog } from '@/features/system';

import { EntitlementModal } from '../components/EntitlementModal';
import { EntitlementsTab } from '../components/EntitlementsTab';
import { GenerateIssuesDialog, IssuesTab } from '../components/IssuesTab';

/**
 * HR → Benefits (P2.08): who is entitled to what (a ration card, a house) and what has been issued against it. The
 * tab is kept in the URL; "Add entitlement" and "Generate issues" are for those who may create (benefit.create).
 */
export function BenefitsPage() {
  const { t } = useTranslation('workforce');
  const canCreate = usePermission('benefit.create');
  const tab = useUrlTab('tab', 'entitlements');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('benefits.title')}
        description={t('benefits.description')}
        actions={
          canCreate ? (
            <span className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onPress={() => {
                  setGenerating(true);
                }}
              >
                {t('issues.generateButton')}
              </Button>
              <Button
                iconStart="plus"
                onPress={() => {
                  setAdding(true);
                }}
              >
                {t('benefits.add')}
              </Button>
            </span>
          ) : undefined
        }
      />
      <Tabs
        label={t('benefits.tabsLabel')}
        {...tab}
        items={[
          {
            id: 'entitlements',
            label: t('benefits.entitlements'),
            content: <EntitlementsTab />,
          },
          {
            id: 'issues',
            label: t('issues.title'),
            content: <IssuesTab />,
          },
        ]}
      />
      {adding ? (
        <EntitlementModal
          entitlement={null}
          profile={null}
          onClose={() => {
            setAdding(false);
          }}
          onRefused={setRefusal}
        />
      ) : null}
      {generating ? (
        <GenerateIssuesDialog
          onClose={() => {
            setGenerating(false);
          }}
          onRefused={setRefusal}
        />
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

export { BenefitsPage as Component };
