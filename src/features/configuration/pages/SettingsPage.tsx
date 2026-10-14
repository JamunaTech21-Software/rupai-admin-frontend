import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { PageError, PageLoading, PermissionNotice, RefusalDialog } from '@/features/system';
import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useUrlParam } from '@/lib/urlState';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Stack } from '@/ui';

import { type Setting, useAllSettings } from '../api/settings';
import { SettingActions } from '../components/SettingActions';
import { SettingModal } from '../components/SettingModal';
import { SettingValueText } from '../components/SettingValueText';

const ANY = 'any';

/** The settings that match the search (key or description) and group, by group in order. */
function grouped(rows: readonly Setting[], search: string, group: string): [string, Setting[]][] {
  const needle = search.trim().toLowerCase();
  const groups = new Map<string, Setting[]>();
  for (const row of rows) {
    if (group !== ANY && row.group !== group) continue;
    if (needle && !row.key.includes(needle) && !(row.description ?? '').toLowerCase().includes(needle))
      continue;
    groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Admin → System settings (P1.11): typed values by dotted key, shown by group. Encrypted values are
 * write-only: the screen shows whether one is set, never the value.
 */
export function SettingsPage() {
  const { t } = useTranslation('config');
  const canCreate = usePermission('system.create');
  const canEdit = usePermission('system.edit');
  const canDelete = usePermission('system.delete');
  const settings = useAllSettings();
  const [search, setSearch] = useUrlParam('q', '');
  const [group, setGroup] = useUrlParam('group', ANY);
  const [, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Setting | 'new' | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);

  const rows = settings.data?.rows ?? [];
  const groups = [...new Set(rows.map((row) => row.group))].sort();
  const shown = grouped(rows, search, group);
  // One update for both: two in a row would each start from the same old query string.
  const clear = () => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('q');
        next.delete('group');
        return next;
      },
      { replace: true },
    );
  };

  const add = canCreate ? (
    <Button
      iconStart="plus"
      onPress={() => {
        setEditing('new');
      }}
    >
      {t('settings.add')}
    </Button>
  ) : undefined;

  const body = settings.isPending ? (
    <PageLoading rows={4} />
  ) : settings.isError ? (
    <PageError
      error={settings.error}
      onRetry={() => void settings.refetch()}
      isRetrying={settings.isFetching}
    />
  ) : rows.length === 0 ? (
    <EmptyState
      kind="new"
      title={t('settings.emptyTitle')}
      description={t('settings.emptyBody')}
      {...(add ? { action: add } : {})}
    />
  ) : shown.length === 0 ? (
    <EmptyState
      kind="no-results"
      title={t('settings.emptyFilteredTitle')}
      description={t('settings.emptyFilteredBody')}
      action={
        <Button variant="secondary" onPress={clear}>
          {t('clearFilters')}
        </Button>
      }
    />
  ) : (
    shown.map(([name, members]) => (
      <Card key={name} title={name} headingLevel={2} padding="none">
        <ul className="flex flex-col divide-y divide-line" aria-label={name}>
          {members.map((setting) => (
            <li
              key={setting.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm break-all text-fg">{setting.key}</code>
                  <Badge tone="neutral" hideIcon label={t(`settings.types.${setting.value_type}`)} />
                  {setting.is_encrypted ? (
                    <Badge tone="info" hideIcon label={t('settings.encrypted')} />
                  ) : null}
                </span>
                {setting.description ? (
                  <span className="text-sm text-fg-muted">{setting.description}</span>
                ) : null}
              </div>
              <div className="flex min-w-0 items-start justify-between gap-2 sm:w-2/5 sm:justify-end">
                <span className="min-w-0 sm:text-end">
                  <span className="sr-only">{t('settings.fields.value')}: </span>
                  <SettingValueText setting={setting} />
                </span>
                {canEdit || canDelete ? (
                  <SettingActions
                    setting={setting}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => {
                      setEditing(setting);
                    }}
                    onRefused={setRefusal}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    ))
  );

  return (
    <Stack gap={6}>
      <PageHeader title={t('settings.title')} description={t('settings.description')} actions={add} />
      {!canCreate && !canEdit ? <PermissionNotice /> : null}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label={t('settings.search')}
            placeholder={t('settings.searchPlaceholder')}
            type="search"
            className="w-full sm:w-72"
            value={search}
            onChange={(text) => {
              setSearch(text === '' ? null : text);
            }}
          />
          <Select
            label={t('settings.fields.group')}
            className="w-full sm:w-56"
            value={group}
            options={[
              { id: ANY, label: t('settings.anyGroup') },
              ...groups.map((name) => ({ id: name, label: name })),
            ]}
            onChange={(value) => {
              setGroup(value === null || value === ANY ? null : value);
            }}
          />
        </div>
      ) : null}
      {body}
      {editing ? (
        <SettingModal
          key={editing === 'new' ? 'new' : `${editing.id}-${String(editing.version)}`}
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

export { SettingsPage as Component };
