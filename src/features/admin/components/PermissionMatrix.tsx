import { useMemo, useState } from 'react';

import { useFormat, useTranslation } from '@/lib/i18n';
import { Accordion, Checkbox, cx, Icon, Input, Switch } from '@/ui';

import { PERMISSION_ACTIONS, type Permission } from '../api/schemas';
import { moduleLabel } from '../labels';

export interface PermissionMatrixProps {
  /** The role's name, for the matrix's accessible name. */
  readonly roleName: string;
  readonly catalogue: readonly Permission[];
  readonly selected: ReadonlySet<string>;
  /** Leave out for a read-only matrix (a system role, or no role.edit permission). */
  readonly onChange?: (next: Set<string>) => void;
  /** Start with only the granted permissions shown (a user's effective permissions). */
  readonly defaultOnlySelected?: boolean;
}

interface ModuleRow {
  readonly module: string;
  readonly permissions: readonly Permission[];
}

const ACTION_ORDER = new Map(PERMISSION_ACTIONS.map((action, index) => [action, index]));

/**
 * The permission matrix of a role (P1.01, P6 §3): every module of the catalogue grouped by area, each with the
 * actions it supports. Rows wrap on small screens instead of a wide grid, so it works on a phone. Sensitive
 * permissions carry a warning (P6 §10).
 */
export function PermissionMatrix({
  roleName,
  catalogue,
  selected,
  onChange,
  defaultOnlySelected = false,
}: PermissionMatrixProps) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(defaultOnlySelected);
  const readOnly = !onChange;

  const groups = useMemo(() => {
    const byGroup = new Map<string, Map<string, Permission[]>>();
    for (const permission of catalogue) {
      const modules = byGroup.get(permission.group) ?? new Map<string, Permission[]>();
      const list = modules.get(permission.module) ?? [];
      list.push(permission);
      modules.set(permission.module, list);
      byGroup.set(permission.group, modules);
    }
    return [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, modules]) => ({
        group,
        modules: [...modules.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([module, permissions]) => ({
            module,
            permissions: [...permissions].sort(
              (x, y) => (ACTION_ORDER.get(x.action) ?? 0) - (ACTION_ORDER.get(y.action) ?? 0),
            ),
          })),
      }));
  }, [catalogue]);

  const needle = query.trim().toLowerCase();
  const visible = groups
    .map((group) => ({
      ...group,
      modules: group.modules.filter(
        (row) =>
          (!needle ||
            row.module.includes(needle.replace(/\s+/g, '_')) ||
            group.group.toLowerCase().includes(needle)) &&
          (!onlySelected || row.permissions.some((p) => selected.has(p.key))),
      ),
    }))
    .filter((group) => group.modules.length > 0);

  function setKeys(keys: readonly string[], on: boolean) {
    if (!onChange) return;
    const next = new Set(selected);
    for (const key of keys) {
      if (on) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  }

  function moduleRow(row: ModuleRow) {
    const keys = row.permissions.map((p) => p.key);
    const count = keys.filter((key) => selected.has(key)).length;
    const label = moduleLabel(row.module);
    return (
      <li
        key={row.module}
        className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 md:flex-row md:items-start md:gap-4"
      >
        <div className="md:w-56 md:shrink-0">
          {readOnly ? (
            <span className="font-medium text-fg">{label}</span>
          ) : (
            <Checkbox
              isSelected={count === keys.length}
              isIndeterminate={count > 0 && count < keys.length}
              onChange={(on) => {
                setKeys(keys, on);
              }}
            >
              <span className="font-medium">{label}</span>
              <span className="sr-only">{t('role.selectModule', { module: label })}</span>
            </Checkbox>
          )}
        </div>
        <ul aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1 ps-7 md:ps-0">
          {row.permissions.map((permission) => {
            const actionLabel = t(`actions.${permission.action}`);
            const marker = permission.sensitive ? (
              <Icon name="alert" size="sm" className="shrink-0 text-warning" label={t('role.sensitive')} />
            ) : null;
            return (
              <li key={permission.key} title={permission.description ?? undefined}>
                {readOnly ? (
                  <span
                    className={cx(
                      'inline-flex items-center gap-1 text-sm',
                      selected.has(permission.key) ? 'text-fg' : 'text-fg-subtle line-through',
                    )}
                  >
                    {selected.has(permission.key) ? (
                      <Icon name="check" size="sm" className="text-success" />
                    ) : null}
                    {actionLabel}
                    {marker}
                  </span>
                ) : (
                  <Checkbox
                    isSelected={selected.has(permission.key)}
                    onChange={(on) => {
                      setKeys([permission.key], on);
                    }}
                  >
                    <span className="inline-flex items-center gap-1 text-sm">
                      {actionLabel}
                      {marker}
                      <span className="sr-only">{label}</span>
                    </span>
                  </Checkbox>
                )}
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  const total = catalogue.length;
  const chosen = catalogue.filter((p) => selected.has(p.key)).length;
  const expanded = needle || onlySelected ? visible.map((g) => g.group) : [];

  return (
    <section aria-label={t('role.matrixLabel', { name: roleName })} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Input
          label={t('role.searchPermissions')}
          placeholder={t('role.searchPlaceholder')}
          className="md:w-72"
          value={query}
          onChange={setQuery}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Switch isSelected={onlySelected} onChange={setOnlySelected}>
            {t('role.onlySelected')}
          </Switch>
          <span className="text-sm text-fg-muted figures" aria-live="polite">
            {t('role.permissionsSelected', { count: format.number(chosen), total: format.number(total) })}
          </span>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-fg-muted">{t('role.noModules', { query })}</p>
      ) : (
        <Accordion
          // Searching opens every matching group; clearing it returns to all closed.
          key={expanded.join('|')}
          allowsMultipleExpanded
          defaultExpandedKeys={expanded}
          headingLevel={3}
          items={visible.map((group) => {
            const keys = group.modules.flatMap((row) => row.permissions.map((p) => p.key));
            const groupChosen = keys.filter((key) => selected.has(key)).length;
            return {
              id: group.group,
              title: group.group,
              summary: `${format.number(groupChosen)} / ${format.number(keys.length)}`,
              content: <ul className="flex flex-col">{group.modules.map(moduleRow)}</ul>,
            };
          })}
        />
      )}
    </section>
  );
}
