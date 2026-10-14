import { useState } from 'react';

import { PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  type DataColumn,
  DataTable,
  EmptyState,
  IconButton,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { type NumberFormat, useNumberFormatList } from '../api/numbering';
import { CountersDrawer } from '../components/CountersDrawer';
import { NumberFormatModal } from '../components/NumberFormatModal';

const ANY = 'any';
const GAPLESS = filterKey('is_gapless');

/**
 * Admin → Document numbering (P1.11): one number format per document type. The set is the system's, so there
 * is no Add or Delete; an administrator changes how each number looks and can read its counters.
 */
export function NumberingPage() {
  const { t } = useTranslation('config');
  const canEdit = usePermission('system.edit');
  const list = useNumberFormatList();
  const { table } = list;
  const [editing, setEditing] = useState<NumberFormat | null>(null);
  const [counting, setCounting] = useState<NumberFormat | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const columns: DataColumn<NumberFormat>[] = [
    {
      id: 'document_type',
      header: t('numbering.columns.document'),
      isSortable: true,
      cell: (format) => (
        <span className="flex flex-col">
          <span className="text-fg">{format.label}</span>
          <span className="font-mono text-sm text-fg-muted">{format.document_type}</span>
        </span>
      ),
    },
    {
      id: 'example',
      header: t('numbering.columns.example'),
      // On one line: a number broken in two reads as two numbers. How often it restarts goes underneath.
      cell: (format) => (
        <span className="flex flex-col">
          <span className="font-mono text-sm whitespace-nowrap">{format.example}</span>
          <span className="text-sm text-fg-muted">{t(`numbering.restarts.${format.reset_frequency}`)}</span>
        </span>
      ),
    },
    {
      id: 'lifecycle',
      header: t('numbering.columns.numbered'),
      cell: (format) =>
        format.is_gapless ? (
          <Badge tone="info" hideIcon label={t('numbering.lifecycle.financial')} />
        ) : (
          <Badge tone="neutral" hideIcon label={t('numbering.lifecycle.operational')} />
        ),
    },
    {
      id: 'prefix',
      header: t('numbering.fields.prefix'),
      canHide: true,
      isHiddenByDefault: true,
      cell: (format) => <span className="font-mono text-sm">{format.prefix}</span>,
    },
    {
      id: 'actions',
      header: t('numbering.columns.actions'),
      align: 'center',
      cell: (format) => (
        <span className="flex items-center justify-center gap-1 whitespace-nowrap">
          {canEdit ? (
            <IconButton
              icon="edit"
              variant="ghost"
              size="sm"
              label={t('numbering.edit', { name: format.label })}
              onPress={() => {
                setEditing(format);
              }}
            />
          ) : null}
          <IconButton
            icon="hash"
            variant="ghost"
            size="sm"
            label={t('numbering.showCounters', { name: format.label })}
            onPress={() => {
              setCounting(format);
            }}
          />
        </span>
      ),
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader title={t('numbering.title')} description={t('numbering.description')} />
      {!canEdit ? <PermissionNotice /> : null}
      <DataTable
        label={t('numbering.title')}
        columns={columns}
        getRowId={(format) => format.id}
        getRowLabel={(format) => format.label}
        storageKey="config-numbering"
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: t('numbering.itemLabel') }}
        toolbar={
          <Select
            label={t('numbering.columns.numbered')}
            className="w-full sm:w-64"
            value={table.filters[GAPLESS] ?? ANY}
            options={[
              { id: ANY, label: t('numbering.filterAny') },
              { id: 'true', label: t('numbering.lifecycle.financial') },
              { id: 'false', label: t('numbering.lifecycle.operational') },
            ]}
            onChange={(value) => {
              table.setFilter(GAPLESS, value === null || value === ANY ? null : value);
            }}
          />
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('numbering.emptyFilteredTitle')}
              description={t('numbering.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState kind="new" title={t('numbering.emptyTitle')} description={t('numbering.emptyBody')} />
          )
        }
      />
      {editing ? (
        <NumberFormatModal
          key={`${editing.id}-${String(editing.version)}`}
          format={editing}
          onClose={() => {
            setEditing(null);
          }}
          onRefused={setRefusal}
        />
      ) : null}
      {counting ? (
        <CountersDrawer
          format={counting}
          onClose={() => {
            setCounting(null);
          }}
        />
      ) : null}
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { NumberingPage as Component };
