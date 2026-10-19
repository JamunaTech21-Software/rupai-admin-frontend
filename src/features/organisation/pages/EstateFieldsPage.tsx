import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { NotFoundState, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { describeError, errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyState,
  IconButton,
  Input,
  LazyFieldMap,
  type MapFeature,
  Select,
  Stack,
  toast,
} from '@/ui';

import { useEstateMap } from '../api/boundaries';
import { useEstateSummary } from '../api/estateProfile';
import { useDeleteNode, useDivisions, useEstateFields, useEstateSections } from '../api/hierarchy';
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

/** Edit and delete icons for one field (field.edit / field.delete); delete asks first, and a refusal is told. */
function RowActions({
  field,
  onRefused,
}: {
  readonly field: Field;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const navigate = useNavigate();
  const canEdit = usePermission('field.edit');
  const canDelete = usePermission('field.delete');
  const remove = useDeleteNode('fields', field);
  const [confirming, setConfirming] = useState(false);
  const number = field.field_number;
  return (
    <span className="flex items-center gap-1">
      {canEdit ? (
        <IconButton
          icon="edit"
          variant="ghost"
          size="sm"
          label={t('estatePages.editField', { name: fieldLabel(field) })}
          onPress={() => {
            void navigate(`/fields/${field.id}`);
          }}
        />
      ) : null}
      {canDelete ? (
        <>
          <IconButton
            icon="trash"
            variant="ghost"
            size="sm"
            label={t('estatePages.deleteField', { name: fieldLabel(field) })}
            onPress={() => {
              setConfirming(true);
            }}
          />
          <ConfirmDialog
            isOpen={confirming}
            onOpenChange={setConfirming}
            title={t('field.deleteTitle', { number })}
            consequence={t('field.deleteBody')}
            confirmLabel={t('actions.delete')}
            tone="danger"
            onConfirm={async () => {
              try {
                await remove.mutateAsync();
                toast.success(t('field.deleted', { number }));
              } catch (error) {
                if (errorBehaviour(error) !== 'conflict') onRefused(error);
              }
              setConfirming(false);
            }}
          />
        </>
      ) : null}
    </span>
  );
}

/** "Label : value" rows, two columns on a wide card, as the design's details. */
function DetailRows({
  rows,
}: {
  readonly rows: readonly { readonly term: string; readonly value: string }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2">
      {rows.map((row) => (
        <div key={row.term} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
          <dt className="text-fg-muted">{row.term}</dt>
          <dd className="text-fg">
            <span aria-hidden="true" className="pe-2 text-fg-muted">
              :
            </span>
            {row.value === '' ? '—' : row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Estate Management → Field / Block (R.3), as the manager's design: the estate's fields across the page with a
 * search, the field type and status filters and a filter button for the rest; below, the chosen field's details
 * beside the map of the estate (its shape highlighted); and the figures the server works out. Adding and editing a
 * field opens its own page, where its shape is drawn, imported or typed.
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
  const shapes = useEstateMap(estate.id);
  const [search, setSearch] = useState('');
  const [fieldType, setFieldType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [showMore, setShowMore] = useState(false);
  const [division, setDivision] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [fieldStatus, setFieldStatus] = useState(ALL);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const all = fields.data ?? [];
  const needle = search.trim().toLowerCase();
  const shown = all.filter(
    (f) =>
      (needle === '' ||
        f.field_number.toLowerCase().includes(needle) ||
        (f.name ?? '').toLowerCase().includes(needle)) &&
      (fieldType === ALL || f.field_type === (fieldType as FieldType)) &&
      (status === ALL || f.status === status) &&
      (division === ALL || f.division_id === division) &&
      (section === ALL || f.section_id === section) &&
      (fieldStatus === ALL || f.field_status === (fieldStatus as FieldStatus)),
  );
  const chosen = all.find((f) => f.id === chosenId) ?? null;
  const divisionName = new Map((divisions.data ?? []).map((d) => [d.id, d.name]));
  const sectionName = new Map(sections.sections.map((s) => [s.id, s.name]));
  const place = (f: Field) =>
    `${divisionName.get(f.division_id) ?? ''} > ${sectionName.get(f.section_id) ?? ''}`;
  const hasMore = division !== ALL || section !== ALL || fieldStatus !== ALL;
  const hasFilters = needle !== '' || fieldType !== ALL || status !== ALL || hasMore;
  const clear = () => {
    setSearch('');
    setFieldType(ALL);
    setStatus(ALL);
    setDivision(ALL);
    setSection(ALL);
    setFieldStatus(ALL);
  };

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
        <button
          type="button"
          aria-pressed={f.id === chosenId}
          className="text-start font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => {
            setChosenId(f.id);
          }}
        >
          {f.name ?? f.field_number}
          <span className="sr-only"> {t('estatePages.showDetails', { name: fieldLabel(f) })}</span>
        </button>
      ),
    },
    {
      id: 'code',
      header: t('estatePages.code'),
      cell: (f) => <span className="font-mono text-sm">{f.field_number}</span>,
    },
    { id: 'field_type', header: t('estatePages.fieldType'), cell: (f) => t(`fieldType.${f.field_type}`) },
    {
      id: 'gross',
      header: t('estatePages.totalAreaAcre'),
      isNumeric: true,
      cell: (f) => <span className="whitespace-nowrap">{area.format(f.gross_area)}</span>,
    },
    {
      id: 'planted',
      header: t('estatePages.plantedArea'),
      isNumeric: true,
      cell: (f) =>
        f.planted_area ? (
          area.format(f.planted_area)
        ) : (
          <span className="text-fg-muted">{t('estatePages.notRecorded')}</span>
        ),
    },
    { id: 'status', header: t('estatePages.status'), cell: (f) => <NodeStatusBadge status={f.status} /> },
    {
      id: 'actions',
      header: t('estatePages.actions'),
      cell: (f) => <RowActions field={f} onRefused={setRefusal} />,
    },
  ];

  const details = chosen
    ? [
        { term: t('estatePages.estate'), value: estate.name },
        { term: t('field.spacing'), value: chosen.spacing ?? '' },
        { term: t('estatePages.division'), value: divisionName.get(chosen.division_id) ?? '' },
        { term: t('field.altitude'), value: chosen.altitude ? format.decimal(chosen.altitude, 2) : '' },
        { term: t('estatePages.section'), value: sectionName.get(chosen.section_id) ?? '' },
        {
          term: t('field.averageSlope'),
          value: chosen.average_slope ? format.decimal(chosen.average_slope, 2) : '',
        },
        { term: t('estatePages.fieldName'), value: chosen.name ?? '' },
        { term: t('field.irrigationSource'), value: chosen.irrigation_source?.name ?? '' },
        { term: t('estatePages.code'), value: chosen.field_number },
        { term: t('field.soilType'), value: chosen.soil_type?.name ?? '' },
        { term: t('estatePages.fieldType'), value: t(`fieldType.${chosen.field_type}`) },
        { term: t('field.drainage'), value: chosen.drainage_class?.name ?? '' },
        { term: t('estatePages.totalArea'), value: area.format(chosen.gross_area) },
        { term: t('estatePages.status'), value: t(`status.${chosen.status}`) },
        {
          term: t('estatePages.plantedArea'),
          value: chosen.planted_area ? area.format(chosen.planted_area) : '',
        },
        { term: t('field.createdBy'), value: chosen.created_by.username },
        {
          term: t('field.plantingYear'),
          value: chosen.planting_year === null ? '' : String(chosen.planting_year),
        },
        { term: t('field.createdOn'), value: format.dateTime(chosen.created_at) },
        { term: t('field.bushType'), value: chosen.tea_variety?.name ?? '' },
        {
          term: t('field.parentField'),
          value: chosen.parent_field ? fieldLabel(chosen.parent_field as Field) : '',
        },
      ]
    : [];

  const fetchError = fields.error
    ? { ...describeError(fields.error), onRetry: () => void fields.refetch() }
    : null;
  const count = (value: number | undefined) => (value === undefined ? '…' : format.number(value));
  const kind = (type: FieldType) => count(figures?.field_types[type]);

  const popup = (feature: MapFeature) => {
    const p = feature.properties;
    const text = (key: string) => (typeof p[key] === 'string' ? p[key] : '');
    return [
      `${text('code')}${text('name') ? ` · ${text('name')}` : ''}`,
      t('estatePages.popupArea', { area: area.format(text('gross_area')) }),
      t('estatePages.popupPlace', { division: text('division_name'), section: text('section_name') }),
      t(`status.${text('status') === 'active' ? 'active' : 'inactive'}`),
    ];
  };

  return (
    <>
      <Card
        title={chosen ? `${t('estatePages.fieldList')} (${place(chosen)})` : t('estatePages.fieldList')}
        headingLevel={2}
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
              ? { message: fetchError.message, requestId: fetchError.requestId, onRetry: fetchError.onRetry }
              : null
          }
          isPlain
          toolbar={
            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label={t('estatePages.searchField')}
                  hideLabel
                  placeholder={t('estatePages.searchFieldPlaceholder')}
                  type="search"
                  className="min-w-48 flex-[2]"
                  value={search}
                  onChange={setSearch}
                />
                <Select
                  label={t('estatePages.fieldType')}
                  hideLabel
                  className="min-w-40 flex-1"
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
                  label={t('estatePages.status')}
                  hideLabel
                  className="min-w-40 flex-1"
                  value={status}
                  options={[
                    { id: ALL, label: t('estatePages.allStatuses') },
                    { id: 'active', label: t('status.active') },
                    { id: 'inactive', label: t('status.inactive') },
                  ]}
                  onChange={(next) => {
                    setStatus(next ?? ALL);
                  }}
                />
                <IconButton
                  icon="filter"
                  variant={showMore || hasMore ? 'secondary' : 'ghost'}
                  label={t('estatePages.moreFilters')}
                  aria-expanded={showMore}
                  onPress={() => {
                    setShowMore((open) => !open);
                  }}
                />
              </div>
              {showMore ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Select
                    label={t('estatePages.division')}
                    value={division}
                    options={[
                      { id: ALL, label: t('estatePages.allDivisions') },
                      ...(divisions.data ?? []).map((d) => ({ id: d.id, label: d.name })),
                    ]}
                    onChange={(next) => {
                      setDivision(next ?? ALL);
                      setSection(ALL);
                    }}
                  />
                  <Select
                    label={t('estatePages.section')}
                    value={section}
                    options={[
                      { id: ALL, label: t('estatePages.allSections') },
                      ...sections.sections
                        .filter((s) => division === ALL || s.division_id === division)
                        .map((s) => ({ id: s.id, label: s.name })),
                    ]}
                    onChange={(next) => {
                      setSection(next ?? ALL);
                    }}
                  />
                  <Select
                    label={t('estatePages.fieldStatus')}
                    value={fieldStatus}
                    options={[
                      { id: ALL, label: t('estatePages.allFieldStatuses') },
                      ...FIELD_STATUSES.map((s) => ({ id: s, label: t(`fieldStatus.${s}`) })),
                    ]}
                    onChange={(next) => {
                      setFieldStatus(next ?? ALL);
                    }}
                  />
                </div>
              ) : null}
            </div>
          }
          emptyState={
            all.length > 0 ? (
              <EmptyState
                kind="no-results"
                title={t('estatePages.noMatch')}
                description={t('estatePages.noMatchBody')}
                action={
                  hasFilters ? (
                    <Button variant="secondary" onPress={clear}>
                      {t('estatePages.clearFilters')}
                    </Button>
                  ) : undefined
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
        {shown.length > 0 ? (
          <p className="border-t border-line px-4 py-3 text-sm text-fg-muted sm:px-6">
            {t('estatePages.showing', { from: 1, to: shown.length, total: shown.length })}
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title={chosen ? t('estatePages.detailsOf', { name: fieldLabel(chosen) }) : t('estatePages.details')}
          headingLevel={2}
          className="min-w-0"
        >
          {chosen ? (
            <DetailRows rows={details} />
          ) : (
            <p className="text-sm text-fg-muted">{t('estatePages.chooseField')}</p>
          )}
        </Card>
        <Card
          title={chosen ? t('estatePages.mapOf', { name: fieldLabel(chosen) }) : t('estatePages.mapView')}
          headingLevel={2}
          className="min-w-0"
        >
          <div className="flex flex-col gap-3">
            {shapes.isError ? (
              <p className="text-sm text-danger">{t('estatePages.mapFailed')}</p>
            ) : (
              <LazyFieldMap
                label={t('estatePages.mapLabel', { name: estate.name })}
                features={shapes.data?.features ?? []}
                selectedId={chosenId}
                onSelect={setChosenId}
                popup={popup}
                bbox={shapes.data?.bbox ?? null}
                text={{
                  street: t('estatePages.map.street'),
                  satellite: t('estatePages.map.satellite'),
                  fullscreen: t('estatePages.map.fullscreen'),
                  exitFullscreen: t('estatePages.map.exitFullscreen'),
                  legend: {
                    selected: t('estatePages.map.selected'),
                    other: t('estatePages.map.other'),
                    road: t('estatePages.map.road'),
                    drain: t('estatePages.map.drain'),
                    section: t('estatePages.map.section'),
                  },
                }}
              />
            )}
            {chosen?.has_boundary ? (
              <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-fg-muted">
                {chosen.perimeter_km ? (
                  <span>{t('estatePages.perimeter', { km: format.decimal(chosen.perimeter_km, 2) })}</span>
                ) : null}
                {chosen.centroid ? (
                  <span>
                    {t('estatePages.coordinates', {
                      lat: format.decimal(chosen.centroid.latitude, 4),
                      lng: format.decimal(chosen.centroid.longitude, 4),
                    })}
                  </span>
                ) : null}
              </p>
            ) : null}
            {chosen && !chosen.has_boundary ? (
              <p className="text-sm text-fg-muted">{t('estatePages.notMapped')}</p>
            ) : null}
            {!chosen && (shapes.data?.unmapped_field_ids.length ?? 0) > 0 ? (
              <p className="text-sm text-fg-muted">
                {t('estatePages.someNotMapped', { count: shapes.data?.unmapped_field_ids.length ?? 0 })}
              </p>
            ) : null}
            {chosen ? (
              <div>
                <ButtonLink href={`/fields/${chosen.id}`} variant="secondary" size="sm">
                  {t('estatePages.openField')}
                </ButtonLink>
              </div>
            ) : null}
          </div>
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
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
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
      {(estate) => (
        <Stack gap={6}>
          <FieldsOfEstate estate={estate} />
        </Stack>
      )}
    </EstateScreen>
  );
}

export { EstateFieldsPage as Component };
