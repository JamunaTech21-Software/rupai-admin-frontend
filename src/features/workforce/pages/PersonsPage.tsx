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

import { usePersonsList } from '../api/persons';
import { GENDERS, type Person, STATUSES } from '../api/schemas';
import { PersonStatusBadge } from '../components/PersonLifecycle';

const SEARCH = filterKey('q');
const STATUS = filterKey('status');
const GENDER = filterKey('gender');
const ESTATE = filterKey('registered_estate_id');

/** Workforce → Persons (P2.01): everyone registered, with search and filters, and the way to add and open one. */
export function PersonsPage() {
  const { t } = useTranslation('workforce');
  const format = useFormat();
  const canCreate = usePermission('person.create');
  const list = usePersonsList();
  const estates = useAllEstates();
  const { table } = list;
  const estateCode = (id: string | null) =>
    id === null ? null : (estates.data?.find((estate) => estate.id === id)?.code ?? `#${id}`);
  const none = <span className="text-fg-subtle">—</span>;

  const columns: DataColumn<Person>[] = [
    {
      id: 'person_code',
      header: t('persons.columns.code'),
      isSortable: true,
      cell: (p) => (
        <Link href={`/workforce/persons/${p.id}`} className="font-mono">
          {p.person_code}
        </Link>
      ),
    },
    {
      id: 'full_name',
      header: t('persons.columns.name'),
      isSortable: true,
      cell: (p) => <span className="font-medium">{p.full_name}</span>,
    },
    { id: 'phone', header: t('persons.columns.phone'), canHide: true, cell: (p) => p.phone ?? none },
    {
      id: 'gender',
      header: t('persons.columns.gender'),
      canHide: true,
      cell: (p) => (p.gender ? t(`genders.${p.gender}`) : none),
    },
    {
      id: 'age',
      header: t('persons.columns.age'),
      isNumeric: true,
      align: 'center',
      canHide: true,
      cell: (p) => (p.age === null ? none : format.number(p.age)),
    },
    {
      id: 'national_id',
      header: t('persons.columns.nationalId'),
      canHide: true,
      cell: (p) => p.national_id ?? none,
    },
    {
      id: 'estate',
      header: t('persons.columns.estate'),
      canHide: true,
      cell: (p) => estateCode(p.registered_estate_id) ?? none,
    },
    {
      id: 'dependents',
      header: t('persons.columns.dependents'),
      isNumeric: true,
      align: 'center',
      canHide: true,
      cell: (p) => format.number(p.dependent_count),
    },
    {
      id: 'status',
      header: t('persons.columns.status'),
      align: 'center',
      cell: (p) => <PersonStatusBadge status={p.status} />,
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
    <Stack gap={6}>
      <PageHeader
        title={t('persons.title')}
        description={t('persons.description')}
        actions={
          canCreate ? (
            <ButtonLink href="/workforce/persons/new" iconStart="plus">
              {t('persons.add')}
            </ButtonLink>
          ) : undefined
        }
      />
      <ScopeNotice scope={list.appliedScope} />
      <DataTable
        label={t('persons.title')}
        columns={columns}
        getRowId={(p) => p.id}
        getRowLabel={(p) => `${p.full_name} (${p.person_code})`}
        storageKey="workforce-persons"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('persons.itemLabel') }}
        toolbar={
          <>
            <Input
              label={t('persons.search')}
              placeholder={t('persons.searchPlaceholder')}
              className="w-full sm:w-56"
              type="search"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            {select(
              ESTATE,
              t('persons.estateFilter'),
              t('persons.anyEstate'),
              (estates.data ?? []).map((estate) => ({
                id: estate.id,
                label: `${estate.code} · ${estate.name}`,
              })),
            )}
            {select(
              GENDER,
              t('persons.genderFilter'),
              t('persons.anyGender'),
              GENDERS.map((g) => ({ id: g, label: t(`genders.${g}`) })),
            )}
            {select(
              STATUS,
              t('persons.statusFilter'),
              t('persons.anyStatus'),
              STATUSES.map((s) => ({ id: s, label: t(`status.${s}`) })),
            )}
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('persons.emptyFilteredTitle')}
              description={t('persons.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('persons.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('persons.emptyNewTitle')}
              description={t('persons.emptyNewBody')}
              action={
                canCreate ? (
                  <ButtonLink href="/workforce/persons/new" iconStart="plus">
                    {t('persons.add')}
                  </ButtonLink>
                ) : undefined
              }
            />
          )
        }
      />
    </Stack>
  );
}

export { PersonsPage as Component };
