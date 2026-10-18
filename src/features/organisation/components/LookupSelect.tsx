import { usePermission } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { type LookupType, lookupText, useActiveLookups } from '@/lib/lookups';
import { Select } from '@/ui';

const NONE = 'none';

/**
 * A pick from a reference list (bush type, irrigation source, soil, drainage): the active rows, "Not recorded" to
 * clear it, and the row the record already has even when it has since been switched off, so opening a record never
 * hides what it holds. Needs lookup.view to load the list (without it only the current row shows).
 */
export function LookupSelect({
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
  /** The chosen row's id, or null. */
  readonly value: string | null;
  /** The row the record has now (id, code, name), kept in the list even if inactive. */
  readonly current: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly onChange: (id: string | null) => void;
  readonly isDisabled?: boolean;
  readonly error?: string | undefined;
}) {
  const { t } = useTranslation('org');
  const canRead = usePermission('lookup.view');
  const rows = useActiveLookups(type, canRead);
  const options = (rows.data ?? []).map((row) => ({
    id: row.id,
    label: lookupText(row, 'name') || lookupText(row, 'code') || `#${row.id}`,
  }));
  if (current && !options.some((option) => option.id === current.id))
    options.push({ id: current.id, label: current.name });
  return (
    <Select
      label={label}
      placeholder={t('field.choose')}
      isDisabled={isDisabled ?? false}
      value={value ?? null}
      options={[{ id: NONE, label: t('profile.notRecorded') }, ...options]}
      onChange={(next) => {
        onChange(next === null || next === NONE ? null : next);
      }}
      {...(error ? { error } : {})}
    />
  );
}
