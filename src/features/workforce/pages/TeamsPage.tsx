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
  Input,
  Link,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { TEAM_STATUSES, TEAM_TYPES, type Team, useTeamsList } from '../api/teams';
import { TeamStatusBadge } from '../components/TeamLifecycle';

const SEARCH = filterKey('name', 'like');
const ESTATE = filterKey('estate_id');
const TYPE = filterKey('team_type');
const STATUS = filterKey('status');

/** Workforce → Teams (P2.04): every worker team the user may see, with who leads it and how many are in it today. */
export function TeamsPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('team.create');
  const list = useTeamsList();
  const estates = useAllEstates();
  const { table } = list;
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Team>[] = [
    {
      id: 'code',
      header: t('teams.columns.code'),
      isSortable: true,
      cell: (team) => (
        <Link href={`/workforce/teams/${team.id}`} className="font-mono">
          {team.code}
        </Link>
      ),
    },
    {
      id: 'name',
      header: t('teams.columns.name'),
      isSortable: true,
      cell: (team) => <span className="font-medium">{team.name}</span>,
    },
    {
      id: 'type',
      header: t('teams.columns.type'),
      canHide: true,
      cell: (team) => t(`teamTypes.${team.team_type}`),
    },
    {
      id: 'supervisor',
      header: t('teams.columns.supervisor'),
      canHide: true,
      cell: (team) => team.supervisor?.full_name ?? none,
    },
    {
      id: 'location',
      header: t('teams.columns.location'),
      canHide: true,
      cell: (team) =>
        team.section || team.division ? (
          <span className="flex flex-col">
            <span>{team.section?.name ?? team.division?.name}</span>
            {team.section && team.division ? (
              <span className="text-sm text-fg-muted">{team.division.name}</span>
            ) : null}
          </span>
        ) : (
          none
        ),
    },
    { id: 'estate', header: t('teams.columns.estate'), canHide: true, cell: (team) => team.estate.code },
    {
      id: 'members',
      header: t('teams.columns.members'),
      isNumeric: true,
      align: 'center',
      cell: (team) => format.number(team.member_count),
    },
    {
      id: 'leader',
      header: t('teams.columns.leader'),
      canHide: true,
      cell: (team) => team.leader?.full_name ?? none,
    },
    {
      id: 'status',
      header: t('teams.columns.status'),
      align: 'center',
      cell: (team) => <TeamStatusBadge status={team.status} />,
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
      className="w-full sm:w-40"
      value={table.filters[key] ?? 'any'}
      options={[{ id: 'any', label: any }, ...options]}
      onChange={(value) => {
        table.setFilter(key, value === 'any' ? null : value);
      }}
    />
  );

  const add = canCreate ? (
    <ButtonLink href="/workforce/teams/new" iconStart="plus">
      {t('teams.add')}
    </ButtonLink>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader title={t('teams.title')} description={t('teams.description')} actions={add} />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('teams.title')}
        columns={columns}
        getRowId={(team) => team.id}
        getRowLabel={(team) => `${team.name} (${team.code})`}
        storageKey="workforce-teams"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('teams.itemLabel') }}
        toolbar={
          <>
            <Input
              label={t('teams.search')}
              placeholder={t('teams.searchPlaceholder')}
              className="w-full sm:w-48"
              type="search"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            {select(
              ESTATE,
              t('teams.estateFilter'),
              t('teams.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              TYPE,
              t('teams.typeFilter'),
              t('teams.anyType'),
              TEAM_TYPES.map((value) => ({ id: value, label: t(`teamTypes.${value}`) })),
            )}
            {select(
              STATUS,
              t('teams.statusFilter'),
              t('teams.anyStatus'),
              TEAM_STATUSES.map((value) => ({ id: value, label: t(`status.${value}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('teams.emptyFilteredTitle')}
              description={t('teams.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('teams.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('teams.emptyNewTitle')}
              description={t('teams.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
    </Stack>
  );
}

export { TeamsPage as Component };
