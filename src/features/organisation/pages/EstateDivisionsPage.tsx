import { useState } from 'react';
import { useParams } from 'react-router';

import { NotFoundState, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Button, Card, type DataColumn, DataTable, EmptyState, IconButton, Input, Select, Stack } from '@/ui';

import { useEstateSummary } from '../api/estateProfile';
import { useDivisions, useEstateSections } from '../api/hierarchy';
import { type Division, type Estate, type NodeStatus, type Section, STATUSES } from '../api/schemas';
import { useArea } from '../area';
import { EstateScreen } from '../components/EstateScreen';
import { NodeLifecycle, NodeStatusBadge } from '../components/NodeLifecycle';
import { type NodeEditor, NodeModal } from '../components/NodeModal';
import { SummaryStrip } from '../components/SummaryStrip';
import { useStructureText } from '../structureText';

const ALL = 'all';

const matches = (node: { code: string; name: string }, search: string) => {
  const needle = search.trim().toLowerCase();
  return (
    needle === '' || node.code.toLowerCase().includes(needle) || node.name.toLowerCase().includes(needle)
  );
};

/** Edit, deactivate / reactivate and delete for one division or section, in its table row. */
function RowActions({
  kind,
  node,
  onEdit,
  onRefused,
}: {
  readonly kind: 'division' | 'section';
  readonly node: Division | Section;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const canEdit = usePermission(`${kind}.edit`);
  const canDelete = usePermission(`${kind}.delete`);
  const text = useStructureText(node.name);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {canEdit ? (
        <IconButton
          icon="edit"
          variant="ghost"
          size="sm"
          label={t(kind === 'division' ? 'structure.editDivision' : 'structure.editSection', {
            name: node.name,
          })}
          onPress={onEdit}
        />
      ) : null}
      <NodeLifecycle
        path={kind === 'division' ? 'divisions' : 'sections'}
        node={node}
        subject={node.name}
        text={text}
        canEdit={canEdit}
        canDelete={canDelete}
        size="sm"
        onRefused={onRefused}
      />
    </span>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  const { t } = useTranslation('org');
  return (
    <Select
      label={t('estatePages.status')}
      className="w-full sm:w-44"
      value={value}
      options={[
        { id: ALL, label: t('estatePages.allStatuses') },
        ...STATUSES.map((status) => ({ id: status, label: t(`status.${status}`) })),
      ]}
      onChange={(next) => {
        onChange(next ?? ALL);
      }}
    />
  );
}

/**
 * Estate Management → Division & Section (R.3): the estate's divisions and every section, each list with its own
 * filters and actions, and the figures under them. Built on the P1.07 division and section APIs.
 */
function DivisionsAndSections({ estate }: { readonly estate: Estate }) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const area = useArea();
  const canAddDivision = usePermission('division.create');
  const canAddSection = usePermission('section.create');
  const divisions = useDivisions(estate.id);
  // Every section of the estate in one request; the figures under the lists come from the server.
  const sections = useEstateSections(estate.id);
  const figures = useEstateSummary(estate.id).data?.hierarchy;
  const [editor, setEditor] = useState<NodeEditor | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [divisionSearch, setDivisionSearch] = useState('');
  const [divisionStatus, setDivisionStatus] = useState(ALL);
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionDivision, setSectionDivision] = useState(ALL);
  const [sectionStatus, setSectionStatus] = useState(ALL);

  const allDivisions = divisions.data ?? [];
  const divisionName = new Map(allDivisions.map((d) => [d.id, d.name]));
  const shownDivisions = allDivisions.filter(
    (d) =>
      matches(d, divisionSearch) && (divisionStatus === ALL || d.status === (divisionStatus as NodeStatus)),
  );
  const shownSections = sections.sections.filter(
    (s) =>
      matches(s, sectionSearch) &&
      (sectionDivision === ALL || s.division_id === sectionDivision) &&
      (sectionStatus === ALL || s.status === (sectionStatus as NodeStatus)),
  );
  const chosenDivision = allDivisions.find((d) => d.id === sectionDivision);
  const isActive = estate.status === 'active';

  const count = (value: number | undefined) => (value === undefined ? '…' : format.number(value));
  const areaCell = (value: string | null) =>
    value ? (
      <span className="whitespace-nowrap">{area.format(value)}</span>
    ) : (
      <span className="text-fg-muted">{t('estatePages.notRecorded')}</span>
    );
  const errorOf = (error: unknown, retry: () => void) => {
    if (!error) return null;
    const { message, requestId } = describeError(error);
    return { message, requestId, onRetry: retry };
  };

  const divisionColumns: DataColumn<Division>[] = [
    {
      id: 'sl',
      header: t('estatePages.sl'),
      isNumeric: true,
      cell: (d) => format.number(shownDivisions.indexOf(d) + 1),
    },
    {
      id: 'name',
      header: t('estatePages.divisionName'),
      cell: (d) => <span className="font-medium">{d.name}</span>,
    },
    {
      id: 'code',
      header: t('estatePages.code'),
      cell: (d) => <span className="font-mono text-sm">{d.code}</span>,
    },
    { id: 'area', header: t('estatePages.totalArea'), isNumeric: true, cell: (d) => areaCell(d.area) },
    {
      id: 'sections',
      header: t('estatePages.sections'),
      isNumeric: true,
      cell: (d) => format.number(d.section_count),
    },
    { id: 'status', header: t('estatePages.status'), cell: (d) => <NodeStatusBadge status={d.status} /> },
    {
      id: 'actions',
      header: t('estatePages.actions'),
      cell: (d) => (
        <RowActions
          kind="division"
          node={d}
          onEdit={() => {
            setEditor({ kind: 'division', mode: 'edit', node: d });
          }}
          onRefused={setRefusal}
        />
      ),
    },
  ];

  const sectionColumns: DataColumn<Section>[] = [
    {
      id: 'sl',
      header: t('estatePages.sl'),
      isNumeric: true,
      cell: (s) => format.number(shownSections.indexOf(s) + 1),
    },
    { id: 'division', header: t('estatePages.division'), cell: (s) => divisionName.get(s.division_id) ?? '' },
    {
      id: 'name',
      header: t('estatePages.sectionName'),
      cell: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      id: 'code',
      header: t('estatePages.code'),
      cell: (s) => <span className="font-mono text-sm">{s.code}</span>,
    },
    {
      id: 'parent',
      header: t('estatePages.parentSection'),
      cell: (s) =>
        s.parent_section ? (
          s.parent_section.name
        ) : (
          <span className="text-fg-muted">{t('estatePages.noParent')}</span>
        ),
    },
    { id: 'area', header: t('estatePages.totalArea'), isNumeric: true, cell: (s) => areaCell(s.area) },
    { id: 'status', header: t('estatePages.status'), cell: (s) => <NodeStatusBadge status={s.status} /> },
    {
      id: 'actions',
      header: t('estatePages.actions'),
      cell: (s) => (
        <RowActions
          kind="section"
          node={s}
          onEdit={() => {
            setEditor({ kind: 'section', mode: 'edit', node: s });
          }}
          onRefused={setRefusal}
        />
      ),
    },
  ];

  const noMatch = (clear: () => void) => (
    <EmptyState
      kind="no-results"
      title={t('estatePages.noMatch')}
      description={t('estatePages.noMatchBody')}
      action={
        <Button variant="secondary" onPress={clear}>
          {t('estatePages.clearFilters')}
        </Button>
      }
    />
  );

  return (
    <>
      <Card
        title={t('estatePages.divisionList')}
        headingLevel={2}
        actions={
          canAddDivision && isActive ? (
            <Button
              size="sm"
              iconStart="plus"
              onPress={() => {
                setEditor({ kind: 'division', mode: 'create', parentId: estate.id, parentName: estate.name });
              }}
            >
              {t('structure.addDivision')}
            </Button>
          ) : undefined
        }
      >
        <DataTable
          label={t('profile.divisions')}
          columns={divisionColumns}
          rows={shownDivisions}
          getRowId={(d) => d.id}
          getRowLabel={(d) => d.name}
          isLoading={divisions.isPending}
          error={errorOf(divisions.error, () => void divisions.refetch())}
          isPlain
          toolbar={
            <>
              <Input
                label={t('estatePages.searchDivision')}
                placeholder={t('estatePages.searchPlaceholder')}
                type="search"
                className="w-full sm:w-64"
                value={divisionSearch}
                onChange={setDivisionSearch}
              />
              <StatusFilter value={divisionStatus} onChange={setDivisionStatus} />
            </>
          }
          emptyState={
            allDivisions.length > 0 ? (
              noMatch(() => {
                setDivisionSearch('');
                setDivisionStatus(ALL);
              })
            ) : (
              <EmptyState
                kind="new"
                title={t('estatePages.noDivisions')}
                description={t('estatePages.noDivisionsBody')}
              />
            )
          }
        />
      </Card>

      <Card
        title={
          chosenDivision
            ? t('estatePages.sectionListOf', { division: chosenDivision.name })
            : t('estatePages.sectionList')
        }
        headingLevel={2}
        actions={
          canAddSection && isActive && allDivisions.some((d) => d.status === 'active') ? (
            <Button
              size="sm"
              iconStart="plus"
              onPress={() => {
                setEditor({
                  kind: 'section',
                  mode: 'create',
                  // The division chosen in the filter, or none: the form then asks.
                  parentId: chosenDivision?.status === 'active' ? chosenDivision.id : '',
                  parentName: chosenDivision?.name ?? '',
                  divisions: allDivisions,
                });
              }}
            >
              {t('structure.addSection')}
            </Button>
          ) : undefined
        }
      >
        <DataTable
          label={t('estatePages.sections')}
          columns={sectionColumns}
          rows={shownSections}
          getRowId={(s) => s.id}
          getRowLabel={(s) => s.name}
          isLoading={divisions.isPending || sections.isPending}
          error={errorOf(sections.error, sections.refetch)}
          isPlain
          toolbar={
            <>
              <Input
                label={t('estatePages.searchSection')}
                placeholder={t('estatePages.searchPlaceholder')}
                type="search"
                className="w-full sm:w-64"
                value={sectionSearch}
                onChange={setSectionSearch}
              />
              <Select
                label={t('estatePages.division')}
                className="w-full sm:w-56"
                value={sectionDivision}
                options={[
                  { id: ALL, label: t('estatePages.allDivisions') },
                  ...allDivisions.map((d) => ({ id: d.id, label: `${d.code} · ${d.name}` })),
                ]}
                onChange={(next) => {
                  setSectionDivision(next ?? ALL);
                }}
              />
              <StatusFilter value={sectionStatus} onChange={setSectionStatus} />
            </>
          }
          emptyState={
            sections.sections.length > 0 ? (
              noMatch(() => {
                setSectionSearch('');
                setSectionDivision(ALL);
                setSectionStatus(ALL);
              })
            ) : (
              <EmptyState
                kind="new"
                title={t('estatePages.noSections')}
                description={t('estatePages.noSectionsBody')}
              />
            )
          }
        />
      </Card>

      <SummaryStrip
        title={t('estatePages.structureSummary')}
        items={[
          { label: t('estatePages.totalDivisions'), value: count(figures?.divisions.total) },
          { label: t('estatePages.totalSections'), value: count(figures?.sections.total) },
          {
            label: t('estatePages.totalArea'),
            value: figures ? format.decimal(figures.division_area, 3) : '…',
            unit: area.unit,
          },
          {
            label: t('estatePages.averageSectionArea'),
            value: figures?.average_section_area
              ? format.decimal(figures.average_section_area, 2)
              : figures
                ? t('estatePages.notRecorded')
                : '…',
            ...(figures?.average_section_area ? { unit: area.unit } : {}),
          },
          { label: t('estatePages.activeDivisions'), value: count(figures?.divisions.active) },
          { label: t('estatePages.activeSections'), value: count(figures?.sections.active) },
        ]}
      />

      {editor ? (
        <NodeModal
          {...editor}
          onClose={() => {
            setEditor(null);
          }}
          onRefused={setRefusal}
        />
      ) : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </>
  );
}

export function EstateDivisionsPage() {
  const { id } = useParams();
  const { t } = useTranslation('org');
  if (id === undefined) return <NotFoundState />;
  return (
    <EstateScreen estateId={id} current="divisions" title={t('profile.tabs.divisions')}>
      {(estate) => (
        <Stack gap={6}>
          <DivisionsAndSections estate={estate} />
        </Stack>
      )}
    </EstateScreen>
  );
}

export { EstateDivisionsPage as Component };
