import { useState } from 'react';

import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Button, Card, EmptyState, Skeleton } from '@/ui';

import { type BenefitEntitlement, useProfileEntitlements } from '../api/benefits';
import { EntitlementActions, EntitlementStateBadge } from './EntitlementActions';
import { EntitlementModal } from './EntitlementModal';

/**
 * A worker's profile, Benefits tab (benefit.view): the Ration Card and any other benefit they hold, newest first, with
 * the card number, dates and where each stands. "Add" gives a new one to this person (benefit.create).
 */
export function ProfileBenefits({
  profileId,
  profileName,
}: {
  readonly profileId: string;
  readonly profileName: string;
}) {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canView = usePermission('benefit.view');
  const canCreate = usePermission('benefit.create');
  const list = useProfileEntitlements(profileId);
  const [editing, setEditing] = useState<BenefitEntitlement | 'new' | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const rows = list.data ?? [];

  if (!canView) return <p className="text-sm text-fg-muted">{t('members.noAccess')}</p>;

  return (
    <Card
      title={t('benefits.card')}
      headingLevel={2}
      actions={
        canCreate ? (
          <Button
            size="sm"
            iconStart="plus"
            onPress={() => {
              setEditing('new');
            }}
          >
            {t('benefits.add')}
          </Button>
        ) : undefined
      }
    >
      {list.isPending ? (
        <Skeleton variant="table-row" columns={3} rows={2} />
      ) : list.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-danger">{t('members.failed')}</span>
          <Button size="sm" variant="secondary" onPress={() => void list.refetch()}>
            {t('employment.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState kind="new" title={t('benefits.cardEmpty')} description={t('benefits.cardIntro')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="flex flex-col">
                <span className="font-medium">{row.benefit_type.name}</span>
                <span className="text-fg-muted">
                  {row.allocation_reference ?? '—'}
                  {row.issuing_office ? ` · ${row.issuing_office}` : ''}
                </span>
              </span>
              <span className="text-fg-muted">
                {format.date(row.effective_from)} – {row.effective_to ? format.date(row.effective_to) : '…'}
              </span>
              <EntitlementStateBadge state={row.state} />
              <EntitlementActions
                entitlement={row}
                onEdit={() => {
                  setEditing(row);
                }}
                onRefused={setRefusal}
              />
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <EntitlementModal
          entitlement={editing === 'new' ? null : editing}
          profile={{ id: profileId, name: profileName }}
          onClose={() => {
            setEditing(null);
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
    </Card>
  );
}
