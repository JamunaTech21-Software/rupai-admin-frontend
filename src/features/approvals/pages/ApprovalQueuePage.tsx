import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  ButtonLink,
  type DataColumn,
  DataTable,
  EmptyState,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { type QueueItem, useApprovalQueue } from '../api/approvals';

const ANY = 'any';
const WAITING = filterKey('waiting_hours_from');
const WAIT_CHOICES = [
  { id: '24', hours: 24 },
  { id: '48', hours: 48 },
  { id: '72', hours: 72 },
] as const;

/**
 * Approvals (P1.14): everything waiting for the signed-in user's decision, across every kind of document, the one
 * waiting longest first. A user always has a queue; what they may decide on each item is the server's answer. Items
 * they would decide for someone who delegated to them say so.
 */
export function ApprovalQueuePage() {
  const { t } = useTranslation('approvals');
  const format = useFormat();
  const canSeeAll = usePermission('workflow.view');
  const list = useApprovalQueue();
  const { table } = list;

  const columns: DataColumn<QueueItem>[] = [
    {
      id: 'document',
      header: t('columns.document'),
      cell: (item) => (
        <span className="flex flex-col">
          <Link href={`/approvals/${item.approval_id}`}>{item.document_number ?? item.document_label}</Link>
          <span className="text-sm text-fg-muted">
            {item.document_number
              ? `${item.document_type_label} · ${item.document_label}`
              : item.document_type_label}
          </span>
          {item.acting_for ? (
            <span className="text-sm text-fg-muted">
              {t('actingFor', { name: item.acting_for.username })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'step',
      header: t('columns.step'),
      cell: (item) =>
        item.step_name ? `${String(item.step_number)} · ${item.step_name}` : String(item.step_number),
    },
    {
      id: 'amount',
      header: t('columns.amount'),
      align: 'end',
      cell: (item) =>
        item.amount === null ? '' : <span className="figures">{format.money(item.amount)}</span>,
    },
    {
      id: 'submitted_by',
      header: t('columns.submittedBy'),
      canHide: true,
      cell: (item) => item.submitted_by.username,
    },
    {
      id: 'waiting',
      header: t('columns.waiting'),
      cell: (item) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{t('hours', { count: item.waiting_hours })}</span>
          {item.has_guard_failure ? <Badge tone="warning" label={t('guardFailed')} /> : null}
        </span>
      ),
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canSeeAll ? (
            <ButtonLink href="/approvals/all" variant="secondary">
              {t('all.title')}
            </ButtonLink>
          ) : undefined
        }
      />
      <DataTable
        label={t('title')}
        columns={columns}
        getRowId={(item) => item.approval_id}
        getRowLabel={(item) => item.document_number ?? item.document_label}
        storageKey="approvals"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('itemLabel') }}
        toolbar={
          <Select
            label={t('filters.waiting')}
            className="w-full sm:w-56"
            value={table.filters[WAITING] ?? ANY}
            options={[
              { id: ANY, label: t('filters.anyWait') },
              ...WAIT_CHOICES.map((choice) => ({
                id: choice.id,
                label: t('filters.atLeast', { count: choice.hours }),
              })),
            ]}
            onChange={(value) => {
              table.setFilter(WAITING, value === null || value === ANY ? null : value);
            }}
          />
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('emptyFilteredTitle')}
              description={t('emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('emptyTitle')} description={t('emptyBody')} />
          )
        }
      />
    </Stack>
  );
}

export { ApprovalQueuePage as Component };
