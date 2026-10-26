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

import { PROGRAM_STATES, type Program, TRAINING_TYPES, useProgramsList } from '../api/training';
import { ProgramStateBadge } from '../components/ProgramActions';

const ESTATE = filterKey('estate_id');
const TYPE = filterKey('training_type');
const STATE = filterKey('state');

/** HR → Training (P2.09): the programmes of the estates the user may see: what, when, where, seats and cost. */
export function TrainingPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('training.create');
  const list = useProgramsList();
  const estates = useAllEstates();
  const { table } = list;
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Program>[] = [
    {
      id: 'program_code',
      header: t('training.columns.code'),
      isSortable: true,
      cell: (p) => (
        <Link href={`/hr/training/${p.id}`} className="font-mono">
          {p.program_code}
        </Link>
      ),
    },
    { id: 'title', header: t('training.columns.title'), isSortable: true, cell: (p) => p.title },
    { id: 'type', header: t('training.columns.type'), cell: (p) => t(`trainingTypes.${p.training_type}`) },
    {
      id: 'dates',
      header: t('training.columns.dates'),
      isSortable: true,
      cell: (p) =>
        p.start_date === p.end_date
          ? format.date(p.start_date)
          : `${format.date(p.start_date)} – ${format.date(p.end_date)}`,
    },
    { id: 'venue', header: t('training.columns.venue'), canHide: true, cell: (p) => p.venue ?? none },
    {
      id: 'participants',
      header: t('training.columns.participants'),
      isNumeric: true,
      align: 'center',
      canHide: true,
      cell: (p) =>
        p.capacity === null
          ? String(p.participant_count)
          : `${String(p.participant_count)} / ${String(p.capacity)}`,
    },
    {
      id: 'cost',
      header: t('training.columns.cost'),
      isNumeric: true,
      align: 'end',
      canHide: true,
      isHiddenByDefault: true,
      cell: (p) => (p.cost ? format.money(p.cost) : none),
    },
    {
      id: 'state',
      header: t('training.columns.state'),
      align: 'center',
      cell: (p) => <ProgramStateBadge state={p.state} />,
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
    <ButtonLink href="/hr/training/new" iconStart="plus">
      {t('training.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('training.title')} description={t('training.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('training.title')}
        columns={columns}
        getRowId={(p) => p.id}
        getRowLabel={(p) => `${p.program_code} ${p.title}`}
        storageKey="hr-training"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('training.itemLabel') }}
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
              t('training.typeFilter'),
              t('training.anyType'),
              TRAINING_TYPES.map((value) => ({ id: value, label: t(`trainingTypes.${value}`) })),
            )}
            {select(
              STATE,
              t('benefits.stateFilter'),
              t('benefits.anyState'),
              PROGRAM_STATES.map((value) => ({ id: value, label: t(`programStates.${value}`) })),
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
              title={t('training.emptyTitle')}
              description={t('training.emptyBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { TrainingPage as Component };
