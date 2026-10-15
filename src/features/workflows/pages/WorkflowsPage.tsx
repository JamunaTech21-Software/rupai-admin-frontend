import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Alert,
  Button,
  ButtonLink,
  DatePicker,
  type DataColumn,
  DataTable,
  EmptyState,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import {
  useDocumentTypeList,
  useEstateChoices,
  type Workflow,
  WORKFLOW_STATES,
  useWorkflowsList,
} from '../api/workflows';
import { WorkflowStateBadge } from '../components/WorkflowStateBadge';

const ANY = 'any';
const STATE = filterKey('state');
const TYPE = filterKey('document_type');
const AS_OF = filterKey('as_of');

/**
 * Admin → Workflows (P1.13, workflow.view): every version of every approval workflow, by document type. Filter by
 * state, by document type, or by "in force on a date". Document types with no active workflow are called out: their
 * documents are approved the moment they are submitted.
 */
export function WorkflowsPage() {
  const { t } = useTranslation('workflows');
  const format = useFormat();
  const canCreate = usePermission('workflow.create');
  const list = useWorkflowsList();
  const types = useDocumentTypeList();
  const estates = useEstateChoices();
  const { table } = list;
  const without = (types.data ?? []).filter((type) => type.active_workflows === 0);
  const estateName = (id: string | null) =>
    id === null
      ? t('scopeAll')
      : (estates.data?.find((estate) => estate.id === id)?.name ?? t('estateNumber', { id }));

  const columns: DataColumn<Workflow>[] = [
    {
      id: 'workflow',
      header: t('columns.workflow'),
      cell: (workflow) => (
        <span className="flex flex-col">
          <Link href={`/admin/workflows/${workflow.id}`}>{workflow.name}</Link>
          <span className="text-sm text-fg-muted">{workflow.code}</span>
        </span>
      ),
    },
    { id: 'type', header: t('columns.type'), cell: (workflow) => workflow.document_type_label },
    {
      id: 'scope',
      header: t('columns.scope'),
      canHide: true,
      cell: (workflow) => estateName(workflow.estate_id),
    },
    {
      id: 'effective',
      header: t('columns.effective'),
      cell: (workflow) =>
        workflow.effective_to
          ? t('period', {
              from: format.date(workflow.effective_from),
              to: format.date(workflow.effective_to),
            })
          : t('periodOpen', { from: format.date(workflow.effective_from) }),
    },
    {
      id: 'steps',
      header: t('columns.steps'),
      align: 'end',
      canHide: true,
      cell: (workflow) => String(workflow.steps.length),
    },
    {
      id: 'state',
      header: t('columns.state'),
      cell: (workflow) => <WorkflowStateBadge state={workflow.state} />,
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canCreate ? (
            <ButtonLink href="/admin/workflows/new" iconStart="plus">
              {t('add')}
            </ButtonLink>
          ) : undefined
        }
      />
      {without.length > 0 ? (
        <Alert tone="warning" title={t('noWorkflow.title', { count: without.length })}>
          <span className="block">{t('noWorkflow.body')}</span>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">{t('noWorkflow.show')}</summary>
            <ul className="mt-2 grid list-disc grid-cols-1 gap-x-6 ps-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {without.map((type) => (
                <li key={type.key}>{type.label}</li>
              ))}
            </ul>
          </details>
        </Alert>
      ) : null}
      <DataTable
        label={t('title')}
        columns={columns}
        getRowId={(workflow) => workflow.id}
        getRowLabel={(workflow) => workflow.name}
        storageKey="workflows"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('itemLabel') }}
        toolbar={
          <>
            <Select
              label={t('filters.type')}
              className="w-full sm:w-64"
              value={table.filters[TYPE] ?? ANY}
              options={[
                { id: ANY, label: t('filters.anyType') },
                ...(types.data ?? []).map((type) => ({ id: type.key, label: type.label })),
              ]}
              onChange={(value) => {
                table.setFilter(TYPE, value === null || value === ANY ? null : value);
              }}
            />
            <Select
              label={t('filters.state')}
              className="w-full sm:w-48"
              value={table.filters[STATE] ?? ANY}
              options={[
                { id: ANY, label: t('filters.anyState') },
                ...WORKFLOW_STATES.map((state) => ({ id: state, label: t(`states.${state}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATE, value === null || value === ANY ? null : value);
              }}
            />
            <DatePicker
              label={t('filters.asOf')}
              hint={t('filters.asOfHint')}
              value={table.filters[AS_OF] ?? null}
              onChange={(value) => {
                table.setFilter(AS_OF, value);
              }}
            />
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
            <EmptyState kind="new" title={t('emptyTitle')} description={t('emptyBody')} />
          )
        }
      />
    </Stack>
  );
}

export { WorkflowsPage as Component };
