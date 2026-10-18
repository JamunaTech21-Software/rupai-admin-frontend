import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
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

import { useEstateSummary } from '../api/estateProfile';
import { useDivisions, useEstateFields, useEstateSections } from '../api/hierarchy';
import {
  type Estate,
  type Field,
  FIELD_STATUSES,
  FIELD_TYPES,
  type FieldStatus,
  type FieldType,
} from '../api/schemas';
import { useArea } from '../area';
import { EstateScreen } from '../components/EstateScreen';
import { NodeStatusBadge } from '../components/NodeLifecycle';
import { SummaryStrip } from '../components/SummaryStrip';

const ALL = 'all';

const fieldLabel = (field: Field) =>
  field.name ? `${field.field_number} · ${field.name}` : field.field_number;

/**
 * Estate Management → Field / Block (R.3): the estate's fields with filters, the chosen field's details beside
 * them (type, parent, planting year, bush type, spacing, altitude, slope, irrigation, soil, drainage, who added it),
 * and the figures under them, which the server works out. Adding and editing a field opens the field's own page
 * (P1.07). The map shape comes with Map & GIS (R.6).
 */
function FieldsOfEstate({ estate }: { readonly estate: Estate }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const area = useArea();
  const canCreate = usePermission('field.create');
  const fields = useEstateFields(estate.id);
  const divisions = useDivisions(estate.id);
  const sections = useEstateSections(estate.id);
  const figures = useEstateSummary(estate.id).data?.hierarchy;
  const [search, setSearch] = useState('');
  const [division, setDivision] = useState(ALL);
  const [fieldStatus, setFieldStatus] = useState(ALL);
  const [fieldType, setFieldType] = useState(ALL);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const all = fields.data ?? [];
  const needle = search.trim().toLowerCase();
  const shown = all.filter(
    (f) =>
      (needle === '' ||
        f.field_number.toLowerCase().includes(needle) ||
        (f.name ?? '').toLowerCase().includes(needle)) &&
      (division === ALL || f.division_id === division) &&
      (fieldStatus === ALL || f.field_status === (fieldStatus as FieldStatus)) &&
      (fieldType === ALL || f.field_type === (fieldType as FieldType)),
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
      id: 'field_type',
      header: t('estatePages.fieldType'),
      cell: (f) => t(`fieldType.${f.field_type}`),
    },
    {
      id: 'field_status',
      canHide: true,
      isHiddenByDefault: true,
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
        { term: t('estatePages.fieldType'), description: t(`fieldType.${chosen.field_type}`) },
        {
          term: t('field.parentField'),
          description: chosen.parent_field
            ? chosen.parent_field.name
              ? `${chosen.parent_field.field_number} · ${chosen.parent_field.name}`
              : chosen.parent_field.field_number
            : '',
        },
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
        {
          term: t('field.plantingYear'),
          description: chosen.planting_year === null ? '' : String(chosen.planting_year),
        },
        { term: t('field.bushType'), description: chosen.tea_variety?.name ?? '' },
        { term: t('field.spacing'), description: chosen.spacing ?? '' },
        {
          term: t('field.altitude'),
          description: chosen.altitude ? format.decimal(chosen.altitude, 2) : '',
          isNumeric: true,
        },
        {
          term: t('field.averageSlope'),
          description: chosen.average_slope ? format.decimal(chosen.average_slope, 2) : '',
          isNumeric: true,
        },
        { term: t('field.irrigationSource'), description: chosen.irrigation_source?.name ?? '' },
        { term: t('field.soilType'), description: chosen.soil_type?.name ?? '' },
        { term: t('field.drainage'), description: chosen.drainage_class?.name ?? '' },
        { term: t('estatePages.remarks'), description: chosen.remarks ?? '' },
        { term: t('field.createdBy'), description: chosen.created_by.username },
        { term: t('field.createdOn'), description: format.dateTime(chosen.created_at) },
      ]
    : [];

  const fetchError = fields.error
    ? { ...describeError(fields.error), onRetry: () => void fields.refetch() }
    : null;
  const count = (value: number | undefined) => (value === undefined ? '…' : format.number(value));
  const kind = (type: FieldType) => count(figures?.field_types[type]);

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
                  label={t('estatePages.fieldType')}
                  className="w-full sm:w-48"
                  value={fieldType}
                  options={[
                    { id: ALL, label: t('estatePages.allFieldTypes') },
                    ...FIELD_TYPES.map((type) => ({ id: type, label: t(`fieldType.${type}`) })),
                  ]}
                  onChange={(next) => {
                    setFieldType(next ?? ALL);
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
                        setFieldType(ALL);
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
          { label: t('estatePages.totalFields'), value: count(figures?.fields.total) },
          { label: t('fieldType.tea_field'), value: kind('tea_field') },
          { label: t('fieldType.nursery'), value: kind('nursery') },
          { label: t('fieldType.extension'), value: kind('extension') },
          { label: t('fieldType.infrastructure'), value: kind('infrastructure') },
          { label: t('estatePages.drainArea'), value: kind('drain') },
          {
            label: t('estatePages.totalArea'),
            value: figures ? format.decimal(figures.field_area, 3) : '…',
            unit: area.unit,
          },
          {
            label: t('estatePages.totalPlanted'),
            value: figures ? format.decimal(figures.planted_area, 3) : '…',
            unit: area.unit,
          },
          { label: t('estatePages.activeFields'), value: count(figures?.fields.active) },
          { label: t('estatePages.inactiveFields'), value: count(figures?.fields.inactive) },
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
