import { useState } from 'react';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyState,
  PageHeader,
  Stack,
  toast,
} from '@/ui';

import { type Delegation, useDelegations, useEndDelegation } from '../api/delegations';
import { DelegationFormModal } from '../components/DelegationFormModal';

const ACTIVE = filterKey('is_active');

/** End one delegation now, after confirming; the record stays. */
function EndButton({
  delegation,
  onRefused,
}: {
  readonly delegation: Delegation;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('approvals');
  const end = useEndDelegation(delegation);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onPress={() => {
          setConfirming(true);
        }}
      >
        {t('delegations.end')}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={t('delegations.endTitle', {
          from: delegation.from_user.username,
          to: delegation.to_user.username,
        })}
        consequence={t('delegations.endBody', { to: delegation.to_user.username })}
        confirmLabel={t('delegations.endConfirm')}
        tone="danger"
        onConfirm={async () => {
          try {
            await end.mutateAsync();
            toast.success(t('delegations.ended'));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setConfirming(false);
        }}
      />
    </>
  );
}

/**
 * Delegations (P1.14, user.view): approval authority handed to another user for a bounded period. They end by
 * themselves; with user.edit an administrator can start one and end one early. Delegation hands over approval only.
 */
export function DelegationsPage() {
  const { t } = useTranslation('approvals');
  const format = useFormat();
  const canEdit = usePermission('user.edit');
  const canPickType = usePermission('workflow.view');
  const list = useDelegations();
  const { table } = list;
  const [adding, setAdding] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  const status = (delegation: Delegation) => {
    if (delegation.ended_at) return <Badge tone="draft" label={t('delegations.statusEnded')} />;
    if (delegation.is_active) return <Badge tone="success" label={t('delegations.statusActive')} />;
    return <Badge tone="info" label={t('delegations.statusOther')} />;
  };

  const columns: DataColumn<Delegation>[] = [
    {
      id: 'who',
      header: t('delegations.columns.who'),
      cell: (delegation) => (
        <span className="flex flex-col">
          <span className="font-medium">
            {t('delegations.fromTo', {
              from: delegation.from_user.username,
              to: delegation.to_user.username,
            })}
          </span>
          <span className="text-sm text-fg-muted">{delegation.reason}</span>
        </span>
      ),
    },
    {
      id: 'type',
      header: t('delegations.columns.type'),
      canHide: true,
      cell: (delegation) => delegation.document_type ?? t('delegations.allTypes'),
    },
    {
      id: 'period',
      header: t('delegations.columns.period'),
      cell: (delegation) =>
        t('delegations.period', {
          from: format.dateTime(delegation.valid_from),
          to: format.dateTime(delegation.valid_to),
        }),
    },
    { id: 'status', header: t('delegations.columns.status'), cell: status },
    ...(canEdit
      ? [
          {
            id: 'actions',
            header: t('delegations.columns.actions'),
            align: 'center',
            cell: (delegation) =>
              delegation.is_active && !delegation.ended_at ? (
                <EndButton delegation={delegation} onRefused={setRefusal} />
              ) : null,
          } satisfies DataColumn<Delegation>,
        ]
      : []),
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('delegations.title')}
        description={t('delegations.description')}
        breadcrumbs={[{ label: t('title'), href: '/approvals' }, { label: t('delegations.title') }]}
        actions={
          canEdit ? (
            <Button
              iconStart="plus"
              onPress={() => {
                setAdding(true);
              }}
            >
              {t('delegations.add')}
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label={t('delegations.title')}
        columns={columns}
        getRowId={(delegation) => delegation.id}
        getRowLabel={(delegation) => `${delegation.from_user.username} → ${delegation.to_user.username}`}
        storageKey="approval-delegations"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('delegations.itemLabel') }}
        toolbar={
          <Checkbox
            isSelected={table.filters[ACTIVE] === 'true'}
            onChange={(on) => {
              table.setFilter(ACTIVE, on ? 'true' : null);
            }}
          >
            {t('delegations.activeOnly')}
          </Checkbox>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('delegations.emptyFilteredTitle')}
              description={t('delegations.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('delegations.emptyTitle')}
              description={t('delegations.emptyBody')}
            />
          )
        }
      />
      {adding ? (
        <DelegationFormModal
          canPickType={canPickType}
          onClose={() => {
            setAdding(false);
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

export { DelegationsPage as Component };
