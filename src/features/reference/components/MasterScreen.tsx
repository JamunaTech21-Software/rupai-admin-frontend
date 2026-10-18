import { type ReactNode, useState } from 'react';

import { ImportButton } from '@/features/imports';
import { PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useFormat, useTranslation } from '@/lib/i18n';
import { filterKey } from '@/lib/urlState';
import {
  Badge,
  Button,
  type Crumb,
  type DataColumn,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Stack,
} from '@/ui';

import { type MasterRow, rowName, useMasterList } from '../api/masters';
import { type MasterField, type MasterType, type RefTarget } from '../masters';
import { MasterModal } from './MasterModal';
import { MasterRowActions } from './MasterRowActions';
import { MasterValue } from './MasterValue';
import { useRefOptions } from './useRefOptions';

type Table = ReturnType<typeof useMasterList>['table'];

const ANY = 'any';
const SEARCH = filterKey('name', 'like');
const STATUS = filterKey('status');
const STATUSES = ['active', 'inactive'] as const;

function RefFilter({
  to,
  label,
  value,
  onChange,
}: {
  readonly to: RefTarget;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation('ref');
  const { options } = useRefOptions(to);
  return (
    <Select
      label={label}
      className="w-full sm:w-56"
      value={value}
      options={[{ id: ANY, label: t('list.any') }, ...options]}
      onChange={onChange}
    />
  );
}

/** A filter of the list for one field: its values, its referenced rows, or yes / no. */
function FieldFilter({ field, table }: { readonly field: MasterField; readonly table: Table }) {
  const { t } = useTranslation('ref');
  const key = filterKey(typeof field.filter === 'string' ? field.filter : field.name);
  const label = t(`fields.${field.name}`);
  const value = table.filters[key] ?? ANY;
  const onChange = (next: string | null) => {
    table.setFilter(key, next === null || next === ANY ? null : next);
  };
  const { type } = field;

  if (type.kind === 'ref') return <RefFilter to={type.to} label={label} value={value} onChange={onChange} />;
  const options =
    type.kind === 'enum'
      ? type.values.map((option) => ({
          id: option,
          label: t(`enums.${field.name}.${option}` as 'enums.grade_category.leaf'),
        }))
      : [
          { id: 'true', label: t('yes') },
          { id: 'false', label: t('no') },
        ];
  return (
    <Select
      label={label}
      className="w-full sm:w-44"
      value={value}
      options={[{ id: ANY, label: t('list.any') }, ...options]}
      onChange={onChange}
    />
  );
}

export interface MasterScreenProps {
  readonly type: MasterType;
  readonly breadcrumbs?: readonly Crumb[];
  /** Under the list: what belongs to this master only (the unit categories). */
  readonly children?: ReactNode;
}

/**
 * The list of one reference master with its filters, and add / edit / deactivate / delete for those who may.
 * Everything shown comes from the master's descriptor, so every master has the same screen.
 */
export function MasterScreen({ type, breadcrumbs, children }: MasterScreenProps) {
  const { t } = useTranslation('ref');
  const format = useFormat();
  const canCreate = usePermission(`${type.permission}.create`);
  const canEdit = usePermission(`${type.permission}.edit`);
  const canDelete = usePermission(`${type.permission}.delete`);
  const list = useMasterList(type);
  const { table } = list;
  const [editing, setEditing] = useState<MasterRow | 'new' | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const title = t(`types.${type.key}.title`);
  const one = t(`types.${type.key}.one`);
  const many = title.toLocaleLowerCase();
  const has = (name: MasterField['name']) => type.fields.some((field) => field.name === name);

  const columns: DataColumn<MasterRow>[] = [
    {
      id: type.keyField,
      header: t(`fields.${type.keyField}`),
      isSortable: true,
      cell: (row) => {
        const key = row[type.keyField];
        return <span className="font-mono text-sm">{typeof key === 'string' ? key : ''}</span>;
      },
    },
    {
      id: 'name',
      header: t('fields.name'),
      isSortable: true,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{rowName(row)}</span>
          {type.hasSystem && row.is_system === true ? (
            <Badge tone="neutral" hideIcon label={t('list.system')} />
          ) : null}
          {/* Active is the norm: only an inactive row says so, which keeps the list narrow. */}
          {row.status === 'inactive' ? <Badge tone="neutral" label={t('status.inactive')} /> : null}
          {type.hasBase && row.is_base === true ? (
            <Badge tone="info" hideIcon label={t('list.base')} />
          ) : null}
        </span>
      ),
    },
    ...type.fields
      .filter((field) => field.isColumn)
      .map((field): DataColumn<MasterRow> => ({
        id: field.name,
        header: t(`fields.${field.name}`),
        canHide: true,
        ...(field.isColumn === 'optional' ? { isHiddenByDefault: true } : {}),
        ...(field.type.kind === 'int' || field.type.kind === 'decimal' ? { isNumeric: true } : {}),
        ...(field.type.kind === 'bool' || field.type.kind === 'time' ? { align: 'center' as const } : {}),
        cell: (row) => <MasterValue field={field} row={row} />,
      })),
    ...(has('sort_order')
      ? [
          {
            id: 'sort_order',
            header: t('fields.sort_order'),
            isNumeric: true,
            isSortable: true,
            canHide: true,
            isHiddenByDefault: true,
            cell: (row) => (typeof row.sort_order === 'number' ? format.number(row.sort_order) : ''),
          } satisfies DataColumn<MasterRow>,
        ]
      : []),
    ...(has('description')
      ? [
          {
            id: 'description',
            header: t('fields.description'),
            canHide: true,
            isHiddenByDefault: true,
            cell: (row) =>
              typeof row.description === 'string' && row.description !== '' ? (
                row.description
              ) : (
                <span className="text-fg-muted">{t('notSet')}</span>
              ),
          } satisfies DataColumn<MasterRow>,
        ]
      : []),
    ...(canEdit || canDelete
      ? [
          {
            id: 'actions',
            header: t('list.actions'),
            align: 'center',
            cell: (row) => (
              <MasterRowActions
                type={type}
                row={row}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => {
                  setEditing(row);
                }}
                onRefused={setRefusal}
              />
            ),
          } satisfies DataColumn<MasterRow>,
        ]
      : []),
  ];

  const add = canCreate ? (
    <span className="flex flex-wrap items-center gap-2">
      <ImportButton type={`lookup.${type.key}`} />
      <Button
        iconStart="plus"
        onPress={() => {
          setEditing('new');
        }}
      >
        {t('list.add', { type: one })}
      </Button>
    </span>
  ) : undefined;

  return (
    <Stack gap={6}>
      <PageHeader
        title={title}
        description={t(`types.${type.key}.about`)}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        actions={add}
      />
      {!canCreate && !canEdit ? <PermissionNotice /> : null}
      <DataTable
        label={title}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={rowName}
        storageKey={`ref-${type.key}`}
        {...list.tableProps}
        pagination={{ ...list.tableProps.pagination, itemLabel: many }}
        toolbar={
          <>
            <Input
              label={t('list.search')}
              placeholder={t('list.searchPlaceholder')}
              className="w-full sm:w-56"
              value={table.filters[SEARCH] ?? ''}
              onChange={(text) => {
                table.setFilter(SEARCH, text);
              }}
            />
            {type.fields
              .filter((field) => field.filter)
              .map((field) => (
                <FieldFilter key={field.name} field={field} table={table} />
              ))}
            <Select
              label={t('list.status')}
              className="w-full sm:w-40"
              value={table.filters[STATUS] ?? ANY}
              options={[
                { id: ANY, label: t('list.anyStatus') },
                ...STATUSES.map((status) => ({ id: status, label: t(`status.${status}`) })),
              ]}
              onChange={(value) => {
                table.setFilter(STATUS, value === null || value === ANY ? null : value);
              }}
            />
          </>
        }
        emptyState={
          table.hasFilters ? (
            <EmptyState
              kind="no-results"
              title={t('list.emptyFilteredTitle', { types: many })}
              description={t('list.emptyFilteredBody')}
              action={
                <Button variant="secondary" onPress={table.clearFilters}>
                  {t('list.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              kind="new"
              title={t('list.emptyNewTitle', { types: many })}
              description={t('list.emptyNewBody')}
              {...(add ? { action: add } : {})}
            />
          )
        }
      />
      {children}
      {editing ? (
        <MasterModal
          // A new modal per row: the form starts from that row's values.
          key={editing === 'new' ? 'new' : `${editing.id}-${String(editing.version)}`}
          type={type}
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
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
    </Stack>
  );
}
