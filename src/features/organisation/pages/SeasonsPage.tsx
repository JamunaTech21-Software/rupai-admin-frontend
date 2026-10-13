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

import { useSeasonsList } from '../api/calendar';
import { useAllEstates } from '../api/hierarchy';
import { type Season, SEASON_STATES } from '../api/schemas';
import { SeasonStateBadge } from '../components/CalendarBadges';
import { ScopeNotice } from '../components/ScopeNotice';

const ESTATE = filterKey('estate_id');
const STATE = filterKey('state');

/** Calendars → Seasons (P1.09): the seasons of the estates the user may see, latest first. */
export function SeasonsPage() {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canCreate = usePermission('season.create');
  const list = useSeasonsList();
  const estates = useAllEstates();
  const { table } = list;
  const estate = (id: string) => estates.data?.find((e) => e.id === id);

  const columns: DataColumn<Season>[] = [
    {
      id: 'code',
      header: t('seasons.columns.code'),
      isSortable: true,
      cell: (season) => <span className="font-mono text-sm">{season.code}</span>,
    },
    {
      id: 'name',
      header: t('seasons.columns.name'),
      cell: (season) => <Link href={`/seasons/${season.id}`}>{season.name}</Link>,
    },
    {
      id: 'estate',
      header: t('seasons.columns.estate'),
      cell: (season) => {
        const found = estate(season.estate_id);
        if (!found) return estates.isPending ? '…' : `#${season.estate_id}`;
        return (
          <span className="flex flex-col">
            <span className="font-mono text-sm">{found.code}</span>
            <span className="text-sm text-fg-muted">{found.name}</span>
          </span>
        );
      },
    },
    {
      id: 'start_date',
      header: t('seasons.columns.start'),
      isSortable: true,
      align: 'center',
      cell: (season) => <span className="whitespace-nowrap">{format.date(season.start_date)}</span>,
    },
    {
      id: 'end_date',
      header: t('seasons.columns.end'),
      align: 'center',
      cell: (season) => <span className="whitespace-nowrap">{format.date(season.end_date)}</span>,
    },
    {
      id: 'state',
      header: t('seasons.columns.state'),
      align: 'center',
      cell: (season) => <SeasonStateBadge state={season.state} />,
    },
  ];

  const add = canCreate ? (
    <ButtonLink href="/seasons/new" iconStart="plus">
      {t('seasons.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('seasons.title')} description={t('seasons.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('seasons.title')}
        columns={columns}
        getRowId={(season) => season.id}
        getRowLabel={(season) => season.name}
        storageKey="cal-seasons"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('seasons.itemLabel') }}
        toolbar={
          <>
            <Select
              label={t('seasons.estateFilter')}
              className="w-full sm:w-64"
              value={table.filters[ESTATE] ?? 'any'}
              options={[
                { id: 'any', label: t('seasons.anyEstate') },
                ...(estates.data ?? []).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` })),
              ]}
              onChange={(value) => {
                table.setFilter(ESTATE, value === 'any' ? null : value);
              }}
            />
            <Select
              label={t('seasons.stateFilter')}
              className="w-full sm:w-40"
              value={table.filters[STATE] ?? 'any'}
              options={[
                { id: 'any', label: t('seasons.anyState') },
                ...SEASON_STATES.map((state) => ({ id: state, label: t(`seasonState.${state}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATE, value === 'any' ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('seasons.emptyFilteredTitle')}
              description={t('seasons.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('periods.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('seasons.emptyNewTitle')}
              description={t('seasons.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { SeasonsPage as Component };
