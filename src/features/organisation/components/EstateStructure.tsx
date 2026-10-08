import { useState } from 'react';

import { PageError, PageLoading } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Accordion, Button, Card, EmptyState, Stack } from '@/ui';

import { useDivisions, useSections } from '../api/hierarchy';
import { type Division, type Estate, type Section } from '../api/schemas';

import { type LifecycleText, NodeLifecycle, NodeStatusBadge } from './NodeLifecycle';
import { type NodeEditor, NodeModal } from './NodeModal';

type Editor = NodeEditor;

function useStructureText(name: string): LifecycleText {
  const { t } = useTranslation('org');
  return {
    deactivateTitle: t('structure.deactivateTitle', { name }),
    deactivateBody: t('structure.deactivateBody'),
    reactivateTitle: t('structure.reactivateTitle', { name }),
    reactivateBody: t('structure.reactivateBody'),
    deleteTitle: t('structure.deleteTitle', { name }),
    deleteBody: t('structure.deleteBody'),
    deactivated: t('structure.deactivated', { name }),
    reactivated: t('structure.reactivated', { name }),
    deleted: t('structure.deleted', { name }),
  };
}

function SectionRow({
  section,
  onEdit,
  onRefused,
}: {
  readonly section: Section;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const canEdit = usePermission('section.edit');
  const canDelete = usePermission('section.delete');
  const text = useStructureText(section.name);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-fg-muted">{section.code}</span>
        <span className="font-medium text-fg">{section.name}</span>
        {section.area ? (
          <span className="text-sm text-fg-muted">{format.quantity(section.area, 'ha')}</span>
        ) : null}
        <NodeStatusBadge status={section.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button variant="ghost" size="sm" iconStart="edit" onPress={onEdit}>
            {t('actions.edit')}
          </Button>
        ) : null}
        <NodeLifecycle
          path="sections"
          node={section}
          subject={section.name}
          text={text}
          canEdit={canEdit}
          canDelete={canDelete}
          size="sm"
          onRefused={onRefused}
        />
      </div>
    </li>
  );
}

function DivisionPanel({
  division,
  onEditor,
  onRefused,
}: {
  readonly division: Division;
  readonly onEditor: (editor: Editor) => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const sections = useSections(division.id);
  const canEdit = usePermission('division.edit');
  const canDelete = usePermission('division.delete');
  const canAddSection = usePermission('section.create');
  const text = useStructureText(division.name);

  return (
    <Stack gap={4}>
      <div className="flex flex-wrap gap-2">
        {canAddSection && division.status === 'active' ? (
          <Button
            variant="secondary"
            size="sm"
            iconStart="plus"
            onPress={() => {
              onEditor({ kind: 'section', mode: 'create', parentId: division.id, parentName: division.name });
            }}
          >
            {t('structure.addSection')}
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            iconStart="edit"
            onPress={() => {
              onEditor({ kind: 'division', mode: 'edit', node: division });
            }}
          >
            {t('actions.edit')}
          </Button>
        ) : null}
        <NodeLifecycle
          path="divisions"
          node={division}
          subject={division.name}
          text={text}
          canEdit={canEdit}
          canDelete={canDelete}
          size="sm"
          onRefused={onRefused}
        />
      </div>
      {sections.isPending ? (
        <PageLoading rows={2} />
      ) : sections.isError ? (
        <PageError error={sections.error} onRetry={() => void sections.refetch()} />
      ) : sections.data.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('structure.noSections')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sections.data.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              onEdit={() => {
                onEditor({ kind: 'section', mode: 'edit', node: section });
              }}
              onRefused={onRefused}
            />
          ))}
        </ul>
      )}
    </Stack>
  );
}

/** The estate's divisions, each expanding to its sections, with add / edit / deactivate / delete in place. */
export function EstateStructure({
  estate,
  onRefused,
}: {
  readonly estate: Estate;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const format = useFormat();
  const divisions = useDivisions(estate.id);
  const canAddDivision = usePermission('division.create');
  const [editor, setEditor] = useState<Editor | null>(null);

  const addDivision =
    canAddDivision && estate.status === 'active' ? (
      <Button
        variant="secondary"
        size="sm"
        iconStart="plus"
        onPress={() => {
          setEditor({ kind: 'division', mode: 'create', parentId: estate.id, parentName: estate.name });
        }}
      >
        {t('structure.addDivision')}
      </Button>
    ) : undefined;

  return (
    <Card
      title={t('structure.title')}
      description={t('structure.intro')}
      headingLevel={2}
      actions={addDivision}
    >
      {divisions.isPending ? (
        <PageLoading rows={3} />
      ) : divisions.isError ? (
        <PageError error={divisions.error} onRetry={() => void divisions.refetch()} />
      ) : divisions.data.length === 0 ? (
        <EmptyState
          kind="new"
          title={t('structure.noDivisionsTitle')}
          description={t('structure.noDivisionsBody')}
        />
      ) : (
        <Accordion
          allowsMultipleExpanded
          headingLevel={3}
          items={divisions.data.map((division) => ({
            id: division.id,
            title: `${division.code} · ${division.name}${division.status === 'inactive' ? ` (${t('status.inactive')})` : ''}`,
            summary: division.area ? format.quantity(division.area, 'ha') : '',
            content: <DivisionPanel division={division} onEditor={setEditor} onRefused={onRefused} />,
          }))}
        />
      )}
      {editor ? (
        <NodeModal
          {...editor}
          onClose={() => {
            setEditor(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </Card>
  );
}
