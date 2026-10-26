import { useState } from 'react';

import { ScopeNotice, useAllEstates } from '@/features/organisation';
import { RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { lookupText, useActiveLookups } from '@/lib/lookups';
import { filterKey } from '@/lib/urlState';
import { Button, type DataColumn, DataTable, EmptyState, Select } from '@/ui';

import { type BenefitEntitlement, ENTITLEMENT_STATES, useEntitlementsList } from '../api/benefits';
import { EntitlementActions, EntitlementStateBadge } from './EntitlementActions';
import { EntitlementModal } from './EntitlementModal';

const ESTATE = filterKey('estate_id');
const TYPE = filterKey('benefit_type_id');
const STATE = filterKey('state');

/**
 * The entitlements of the estates the user may see (benefit.view): whose, what, from and till when, the card number,
 * and where each stands, with the actions each user may take. "Add" is in the page header.
 */
export function EntitlementsTab() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canRead = usePermission('lookup.view');
  const list = useEntitlementsList();
  const estates = useAllEstates();
  const types = useActiveLookups('benefit_type', canRead);
  const [editing, setEditing] = useState<BenefitEntitlement | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const { table } = list;
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<BenefitEntitlement>[] = [
    {
      id: 'employee',
      header: t('benefits.columns.employee'),
      cell: (e) => (
        <span className="flex flex-col">
          <span className="font-medium">{e.profile.full_name}</span>
          <span className="font-mono text-sm text-fg-muted">{e.profile.profile_number}</span>
        </span>
      ),
    },
    { id: 'type', header: t('benefits.columns.type'), cell: (e) => e.benefit_type.name },
    {
      id: 'reference',
      header: t('benefits.columns.reference'),
      canHide: true,
      cell: (e) => e.allocation_reference ?? none,
    },
    {
      id: 'from',
      header: t('benefits.columns.from'),
      isSortable: true,
      cell: (e) => format.date(e.effective_from),
    },
    {
      id: 'to',
      header: t('benefits.columns.to'),
      canHide: true,
      cell: (e) => (e.effective_to ? format.date(e.effective_to) : none),
    },
    {
      id: 'quantity',
      header: t('benefits.columns.quantity'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      cell: (e) => (e.quantity_per_period ? format.decimal(e.quantity_per_period, 1) : none),
    },
    {
      id: 'state',
      header: t('benefits.columns.state'),
      align: 'center',
      cell: (e) => <EntitlementStateBadge state={e.state} />,
    },
    {
      id: 'actions',
      header: t('benefits.columns.actions'),
      cell: (e) => (
        <EntitlementActions
          entitlement={e}
          onEdit={() => {
            setEditing(e);
          }}
          onRefused={setRefusal}
        />
      ),
    },
  ];

  const select = (
    key: string,
    label: string,
    any: string,
    options: readonly { id: string; label: string }[],
  ) => (
    <Select
      label={label}
      className="w-full sm:w-44"
      value={table.filters[key] ?? 'any'}
      options={[{ id: 'any', label: any }, ...options]}
      onChange={(value) => {
        table.setFilter(key, value === 'any' ? null : value);
      }}
    />
  );

  return (
    <>
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('benefits.entitlements')}
        columns={columns}
        getRowId={(e) => e.id}
        getRowLabel={(e) => `${e.profile.full_name} · ${e.benefit_type.name}`}
        storageKey="hr-benefit-entitlements"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('benefits.itemLabel') }}
        toolbar={
          <>
            {select(
              ESTATE,
              t('benefits.estateFilter'),
              t('benefits.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              TYPE,
              t('benefits.typeFilter'),
              t('benefits.anyType'),
              (types.data ?? []).map((row) => ({ id: row.id, label: lookupText(row, 'name') })),
            )}
            {select(
              STATE,
              t('benefits.stateFilter'),
              t('benefits.anyState'),
              ENTITLEMENT_STATES.map((value) => ({ id: value, label: t(`entitlementStates.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('benefits.emptyFilteredTitle')}
              description={t('benefits.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('benefits.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('benefits.emptyTitle')} description={t('benefits.emptyBody')} />
          )
        }
      />
      {editing ? (
        <EntitlementModal
          entitlement={editing}
          profile={null}
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
    </>
  );
}
