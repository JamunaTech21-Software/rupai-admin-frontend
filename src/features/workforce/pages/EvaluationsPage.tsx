import { ScopeNotice, useAllEstates } from '@/features/organisation';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
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

import { EVALUATION_STATES, EVALUATION_TYPES, type Evaluation, useEvaluationsList } from '../api/performance';
import { EvaluationStateBadge, RatingBadge } from '../components/EvaluationStateBadge';

const ESTATE = filterKey('estate_id');
const TYPE = filterKey('evaluation_type');
const STATE = filterKey('state');

/** HR → Evaluations (P2.10): the evaluations the user may see, newest period first. */
export function EvaluationsPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('evaluation.create');
  const list = useEvaluationsList();
  const estates = useAllEstates();
  const { table } = list;

  const columns: DataColumn<Evaluation>[] = [
    {
      id: 'evaluation_number',
      header: t('evaluations.columns.number'),
      isSortable: true,
      cell: (e) => (
        <Link href={`/hr/evaluations/${e.id}`} className="font-mono">
          {e.evaluation_number}
        </Link>
      ),
    },
    { id: 'employee', header: t('evaluations.columns.employee'), cell: (e) => e.profile.full_name },
    {
      id: 'reviewer',
      header: t('evaluations.columns.reviewer'),
      canHide: true,
      cell: (e) => e.reviewer?.full_name ?? <span className="text-fg-subtle">—</span>,
    },
    {
      id: 'period_end',
      header: t('evaluations.columns.period'),
      isSortable: true,
      cell: (e) => `${format.date(e.period_start)} – ${format.date(e.period_end)}`,
    },
    {
      id: 'type',
      header: t('evaluations.columns.type'),
      canHide: true,
      cell: (e) => t(`evaluationTypes.${e.evaluation_type}`),
    },
    {
      id: 'score',
      header: t('evaluations.columns.score'),
      isNumeric: true,
      align: 'end',
      cell: (e) => (e.overall_score === null ? '—' : format.decimal(e.overall_score, 2)),
    },
    {
      id: 'rating',
      header: t('evaluations.columns.rating'),
      align: 'center',
      canHide: true,
      cell: (e) => <RatingBadge rating={e.overall_rating} />,
    },
    {
      id: 'state',
      header: t('evaluations.columns.state'),
      align: 'center',
      cell: (e) => <EvaluationStateBadge state={e.state} />,
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

  const add = canCreate ? (
    <ButtonLink href="/hr/evaluations/new" iconStart="plus">
      {t('evaluations.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('evaluations.title')} description={t('evaluations.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('evaluations.title')}
        columns={columns}
        getRowId={(e) => e.id}
        getRowLabel={(e) => `${e.evaluation_number} ${e.profile.full_name}`}
        storageKey="hr-evaluations"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('evaluations.itemLabel') }}
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
              t('evaluations.type'),
              t('evaluations.anyType'),
              EVALUATION_TYPES.map((value) => ({ id: value, label: t(`evaluationTypes.${value}`) })),
            )}
            {select(
              STATE,
              t('benefits.stateFilter'),
              t('benefits.anyState'),
              EVALUATION_STATES.map((value) => ({ id: value, label: t(`evaluationStates.${value}`) })),
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
            <EmptyState
              kind="new"
              title={t('evaluations.emptyTitle')}
              description={t('evaluations.emptyBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { EvaluationsPage as Component };
