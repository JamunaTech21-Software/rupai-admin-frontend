import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  Checkbox,
  type DataColumn,
  DataTable,
  EmptyState,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { type Approval, REQUEST_STATES, useAllApprovals } from '../api/approvals';
import { ApprovalStateBadge } from '../components/ApprovalStateBadge';

const ANY = 'any';
const STATE = filterKey('state');
const UNRESOLVED = filterKey('is_unresolved');

/**
 * All approvals (P1.14, workflow.view): every approval in the user's scope, the oldest submission first. The
 * ageing and exceptions view for an administrator: "nobody can act" narrows it to the approvals stuck on a step that
 * resolves to nobody.
 */
export function AllApprovalsPage() {
  const { t } = useTranslation('approvals');
  const format = useFormat();
  const list = useAllApprovals();
  const { table } = list;

  const columns: DataColumn<Approval>[] = [
    {
      id: 'document',
      header: t('columns.document'),
      cell: (approval) => (
        <span className="flex flex-col">
          <Link href={`/approvals/${approval.id}`}>
            {approval.document_number ?? approval.document_label}
          </Link>
          <span className="text-sm text-fg-muted">{approval.document_type_label}</span>
        </span>
      ),
    },
    {
      id: 'state',
      header: t('columns.state'),
      cell: (approval) => (
        <span className="flex flex-wrap items-center gap-2">
          <ApprovalStateBadge state={approval.state} />
          {approval.is_unresolved ? <Badge tone="warning" label={t('all.nobody')} /> : null}
        </span>
      ),
    },
    {
      id: 'step',
      header: t('columns.step'),
      cell: (approval) => (approval.current_step_number === null ? '' : String(approval.current_step_number)),
    },
    {
      id: 'amount',
      header: t('columns.amount'),
      align: 'end',
      cell: (approval) =>
        approval.amount === null ? '' : <span className="figures">{format.money(approval.amount)}</span>,
    },
    {
      id: 'submitted_by',
      header: t('columns.submittedBy'),
      canHide: true,
      cell: (approval) => approval.submitted_by.username,
    },
    {
      id: 'submitted_at',
      header: t('columns.submittedAt'),
      canHide: true,
      cell: (approval) => format.dateTime(approval.submitted_at),
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('all.title')}
        description={t('all.description')}
        breadcrumbs={[{ label: t('title'), href: '/approvals' }, { label: t('all.title') }]}
      />
      <DataTable
        label={t('all.title')}
        columns={columns}
        getRowId={(approval) => approval.id}
        getRowLabel={(approval) => approval.document_number ?? approval.document_label}
        storageKey="approvals-all"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('itemLabel') }}
        toolbar={
          <>
            <Select
              label={t('filters.state')}
              className="w-full sm:w-52"
              value={table.filters[STATE] ?? ANY}
              options={[
                { id: ANY, label: t('filters.anyState') },
                ...REQUEST_STATES.map((state) => ({ id: state, label: t(`states.${state}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATE, value === null || value === ANY ? null : value);
              }}
            />
            <Checkbox
              isSelected={table.filters[UNRESOLVED] === 'true'}
              onChange={(on) => {
                table.setFilter(UNRESOLVED, on ? 'true' : null);
              }}
            >
              {t('filters.unresolved')}
            </Checkbox>
          </>
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
            <EmptyState kind="new" title={t('all.emptyTitle')} description={t('all.emptyBody')} />
          )
        }
      />
    </Stack>
  );
}

export { AllApprovalsPage as Component };
