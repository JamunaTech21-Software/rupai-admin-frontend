import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { type LookupType, lookupText, useActiveLookups } from '@/lib/lookups';
import { MultiSelect, Select } from '@/ui';

const NONE = 'none';

/** The text of a reference row as a picker shows it: its name, else its code. */
const rowLabel = (row: Parameters<typeof lookupText>[0]) =>
  lookupText(row, 'name') || lookupText(row, 'code') || `#${row?.id ?? ''}`;

/**
 * A pick from a reference list (nationality, religion, education): the active rows, "Not recorded" to clear it, and
 * the row the person already has even when it has since been switched off, so opening a record never hides what it
 * holds. Needs lookup.view to load the list (without it only the current row shows).
 */
export function LookupPick({
  type,
  label,
  value,
  current,
  onChange,
  isDisabled,
  error,
}: {
  readonly type: LookupType;
  readonly label: string;
  readonly value: string | null;
  readonly current: { readonly id: string; readonly name: string } | null;
  readonly onChange: (id: string | null) => void;
  readonly isDisabled?: boolean;
  readonly error?: string | undefined;
}) {
  const { t } = useTranslation('workforce');
  const canRead = usePermission('lookup.view');
  const rows = useActiveLookups(type, canRead);
  const options = (rows.data ?? []).map((row) => ({ id: row.id, label: rowLabel(row) }));
  if (current && !options.some((option) => option.id === current.id))
    options.push({ id: current.id, label: current.name });
  return (
    <Select
      label={label}
      placeholder={t('person.select')}
      isDisabled={isDisabled ?? false}
      value={value ?? NONE}
      options={[{ id: NONE, label: t('person.notRecorded') }, ...options]}
      onChange={(next) => {
        onChange(next === null || next === NONE ? null : next);
      }}
      {...(error ? { error } : {})}
    />
  );
}

/** The same over several rows (skills, languages): the whole set is sent, replacing the previous one. */
export function LookupMultiSelect({
  type,
  label,
  value,
  current,
  onChange,
  isDisabled,
}: {
  readonly type: LookupType;
  readonly label: string;
  readonly value: readonly string[];
  readonly current: readonly { readonly id: string; readonly name: string }[];
  readonly onChange: (ids: string[]) => void;
  readonly isDisabled?: boolean;
}) {
  const { t } = useTranslation('workforce');
  const canRead = usePermission('lookup.view');
  const rows = useActiveLookups(type, canRead);
  const options = (rows.data ?? []).map((row) => ({ id: row.id, label: rowLabel(row) }));
  for (const row of current) {
    if (!options.some((option) => option.id === row.id)) options.push({ id: row.id, label: row.name });
  }
  return (
    <MultiSelect
      label={label}
      placeholder={t('person.select')}
      isDisabled={isDisabled ?? false}
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
