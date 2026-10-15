import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Dec } from '@/lib/money';
import {
  Button,
  ButtonLink,
  Card,
  type DataColumn,
  DataTable,
  type DescriptionItem,
  DescriptionList,
  EmptyState,
  IconButton,
  Input,
  Select,
} from '@/ui';

import { useDivisions, useEstateFields, useEstateSections } from '../api/hierarchy';
import { type Estate, type Field, FIELD_STATUSES, type FieldStatus } from '../api/schemas';
import { useArea } from '../area';
import { EstateScreen } from '../components/EstateScreen';
import { NodeStatusBadge } from '../components/NodeLifecycle';
import { SummaryStrip } from '../components/SummaryStrip';

const ALL = 'all';

const fieldLabel = (field: Field) =>
  field.name ? `${field.field_number} · ${field.name}` : field.field_number;

/**
 * Estate Management → Field / Block (R.3): the estate's fields with filters, the chosen field's details beside
 * them, and the figures under them. Adding and editing a field opens the field's own page (P1.07). What the design
 * shows that the backend does not hold (field type, planting year, soil, drainage, slope, altitude, irrigation,
 * spacing, bush type, map shape) is left out until the backend has it.
 */
function FieldsOfEstate({ estate }: { readonly estate: Estate }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const area = useArea();
  const canCreate = usePermission('field.create');
  const fields = useEstateFields(estate.id);
  const divisions = useDivisions(estate.id);
  const sections = useEstateSections(divisions.data ?? []);
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState(ALL);
  const [fieldStatus, setFieldStatus] = useState(ALL);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const all = fields.data ?? [];
  const needle = search.trim().toLowerCase();
  const shown = all.filter(
    (f) =>
      (needle === '' ||
        f.field_number.toLowerCase().includes(needle) ||
        (f.name ?? '').toLowerCase().includes(needle)) &&
      (division === ALL || f.division_id === division) &&
      (fieldStatus === ALL || f.field_status === (fieldStatus as FieldStatus)),
  );
  const chosen = all.find((f) => f.id === chosenId) ?? null;
  const divisionName = new Map((divisions.data ?? []).map((d) => [d.id, d.name]));
  const sectionName = new Map(sections.sections.map((s) => [s.id, s.name]));
  const place = (f: Field) =>
    [sectionName.get(f.section_id), divisionName.get(f.division_id)].filter(Boolean).join(' · ');
  const notRecorded = <span className="text-fg-muted">{t('estatePages.notRecorded')}</span>;

  const columns: DataColumn<Field>[] = [
    {
      id: 'sl',
      header: t('estatePages.sl'),
      isNumeric: true,
      cell: (f) => format.number(shown.indexOf(f) + 1),
    },
    {
      id: 'field',
      header: t('estatePages.fieldName'),
      cell: (f) => (
        <span className="flex flex-col">
          <span className="font-medium">{fieldLabel(f)}</span>
          <span className="text-sm text-fg-muted">{place(f)}</span>
        </span>
      ),
    },
    {
      id: 'field_status',
      header: t('estatePages.fieldStatus'),
      cell: (f) => t(`fieldStatus.${f.field_status}`),
    },
    {
      id: 'gross',
      header: t('estatePages.totalArea'),
      isNumeric: true,
      cell: (f) => <span className="whitespace-nowrap">{area.format(f.gross_area)}</span>,
    },
    {
      id: 'planted',
      header: t('estatePages.plantedArea'),
      isNumeric: true,
      cell: (f) => (f.planted_area ? area.format(f.planted_area) : notRecorded),
    },
    { id: 'status', header: t('estatePages.status'), cell: (f) => <NodeStatusBadge status={f.status} /> },
    {
      id: 'actions',
      header: t('estatePages.actions'),
      cell: (f) => (
        <IconButton
          icon="info"
          variant={f.id === chosenId ? 'secondary' : 'ghost'}
          size="sm"
          label={t('estatePages.showDetails', { name: fieldLabel(f) })}
          onPress={() => {
            setChosenId(f.id);
          }}
        />
      ),
    },
  ];

  const details: DescriptionItem[] = chosen
    ? [
        { term: t('estatePages.number'), description: chosen.field_number },
        { term: t('field.name'), description: chosen.name ?? '' },
        { term: t('estatePages.division'), description: divisionName.get(chosen.division_id) ?? '' },
        { term: t('estatePages.section'), description: sectionName.get(chosen.section_id) ?? '' },
        { term: t('estatePages.totalArea'), description: area.format(chosen.gross_area), isNumeric: true },
        {
          term: t('estatePages.plantedArea'),
          description: chosen.planted_area ? area.format(chosen.planted_area) : '',
          isNumeric: true,
        },
        { term: t('estatePages.fieldStatus'), description: t(`fieldStatus.${chosen.field_status}`) },
        { term: t('estatePages.status'), description: <NodeStatusBadge status={chosen.status} /> },
        {
          term: t('estatePages.inSectionSince'),
          description: chosen.section_effective_from ? format.date(chosen.section_effective_from) : '',
        },
        { term: t('estatePages.remarks'), description: chosen.remarks ?? '' },
      ]
    : [];

  const fetchError = fields.error
    ? { ...describeError(fields.error), onRetry: () => void fields.refetch() }
    : null;
  const sum = (values: readonly (string | null)[]) =>
    values.reduce((total, value) => (value ? total.plus(value) : total), new Dec(0)).toFixed(3);
  const countOf = (status: FieldStatus) => all.filter((f) => f.field_status === status).length;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card
          title={t('estatePages.fieldList')}
          headingLevel={2}
          className="min-w-0 xl:col-span-8"
          actions={
            canCreate && estate.status === 'active' ? (
              <ButtonLink href="/fields/new" size="sm" iconStart="plus">
                {t('fields.add')}
              </ButtonLink>
            ) : undefined
          }
        >
          <DataTable
            label={t('profile.fields')}
            columns={columns}
            rows={shown}
            getRowId={(f) => f.id}
            getRowLabel={fieldLabel}
            isLoading={fields.isPending}
            error={
              fetchError
                ? {
                    message: fetchError.message,
                    requestId: fetchError.requestId,
                    onRetry: fetchError.onRetry,
                  }
                : null
            }
            isPlain
            toolbar={
              <>
                <Input
                  label={t('estatePages.searchField')}
                  placeholder={t('estatePages.searchPlaceholder')}
                  type="search"
                  className="w-full sm:w-56"
                  value={search}
                  onChange={setSearch}
                />
                <Select
                  label={t('estatePages.division')}
                  className="w-full sm:w-48"
                  value={division}
                  options={[
                    { id: ALL, label: t('estatePages.allDivisions') },
                    ...(divisions.data ?? []).map((d) => ({ id: d.id, label: d.name })),
                  ]}
                  onChange={(next) => {
                    setDivision(next ?? ALL);
                  }}
                />
                <Select
                  label={t('estatePages.fieldStatus')}
                  className="w-full sm:w-48"
                  value={fieldStatus}
                  options={[
                    { id: ALL, label: t('estatePages.allFieldStatuses') },
                    ...FIELD_STATUSES.map((s) => ({ id: s, label: t(`fieldStatus.${s}`) })),
                  ]}
                  onChange={(next) => {
                    setFieldStatus(next ?? ALL);
                  }}
                />
              </>
            }
            emptyState={
              all.length > 0 ? (
                <EmptyState
                  kind="no-results"
                  title={t('estatePages.noMatch')}
                  description={t('estatePages.noMatchBody')}
                  action={
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setSearch('');
                        setDivision(ALL);
                        setFieldStatus(ALL);
                      }}
                    >
                      {t('estatePages.clearFilters')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  kind="new"
                  title={t('estatePages.noFields')}
                  description={t('estatePages.noFieldsBody')}
                />
              )
            }
          />
        </Card>
        <Card
          title={chosen ? t('estatePages.detailsOf', { name: fieldLabel(chosen) }) : t('estatePages.details')}
          headingLevel={2}
          className="min-w-0 xl:col-span-4"
          {...(chosen
            ? {
                footer: (
                  <div className="flex sm:justify-end">
                    <ButtonLink
                      href={`/fields/${chosen.id}`}
                      variant="secondary"
                      className="w-full sm:w-auto"
                    >
                      {t('estatePages.openField')}
                    </ButtonLink>
                  </div>
                ),
              }
            : {})}
        >
          {chosen ? (
            <DescriptionList items={details} />
          ) : (
            <p className="text-sm text-fg-muted">{t('estatePages.chooseField')}</p>
          )}
        </Card>
      </div>

      <SummaryStrip
        title={t('estatePages.fieldSummary')}
        items={[
          { label: t('estatePages.totalFields'), value: format.number(all.length) },
          {
            label: t('estatePages.totalArea'),
            value: format.decimal(sum(all.map((f) => f.gross_area)), 3),
            unit: area.unit,
          },
          {
            label: t('estatePages.totalPlanted'),
            value: format.decimal(sum(all.map((f) => f.planted_area)), 3),
            unit: area.unit,
          },
          { label: t('fieldStatus.producing'), value: format.number(countOf('producing')) },
          { label: t('fieldStatus.young'), value: format.number(countOf('young')) },
          { label: t('fieldStatus.nursery'), value: format.number(countOf('nursery')) },
        ]}
      />
    </>
  );
}

export function EstateFieldsPage() {
  const { id } = useParams();
  const { t } = useTranslation('org');
  if (id === undefined) return <NotFoundState />;
  return (
    <EstateScreen estateId={id} current="fields" title={t('profile.tabs.fields')}>
      {(estate) => <FieldsOfEstate estate={estate} />}
    </EstateScreen>
  );
}

export { EstateFieldsPage as Component };
