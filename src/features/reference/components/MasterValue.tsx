import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge } from '@/ui';

import { type MasterRow } from '../api/masters';
import { type MasterField, type RefTarget } from '../masters';
import { useRefOptions } from './useRefOptions';

/** The row a reference points to, by its label; an empty reference says what that means, if anything. */
function RefValue({
  to,
  id,
  emptyMeans,
}: {
  readonly to: RefTarget;
  readonly id: string | null;
  readonly emptyMeans: MasterField['emptyMeans'];
}) {
  const { t } = useTranslation('ref');
  const { labelOf, shortOf, isPending } = useRefOptions(to);
  if (id === null) {
    return emptyMeans ? <span>{t(emptyMeans)}</span> : <span className="text-fg-muted">{t('notSet')}</span>;
  }
  return <span title={labelOf(id)}>{shortOf(id) ?? (isPending ? '…' : `#${id}`)}</span>;
}

/** One field of a reference row as the list shows it. */
export function MasterValue({ field, row }: { readonly field: MasterField; readonly row: MasterRow }) {
  const { t } = useTranslation('ref');
  const format = useFormat();
  const value = row[field.name];
  const { type } = field;

  if (type.kind === 'ref') {
    return (
      <RefValue to={type.to} id={typeof value === 'string' ? value : null} emptyMeans={field.emptyMeans} />
    );
  }
  if (type.kind === 'bool') {
    return value === true ? (
      <Badge tone="info" hideIcon label={t('yes')} />
    ) : (
      <span className="text-fg-muted">{t('no')}</span>
    );
  }
  if (value === null || value === undefined || value === '') {
    return <span className="text-fg-muted">{t('notSet')}</span>;
  }
  if (type.kind === 'int' && typeof value === 'number') return format.number(value);
  if (typeof value !== 'string') return null;
  if (type.kind === 'decimal') return format.decimal(value, 0);
  if (type.kind === 'enum') return t(`enums.${field.name}.${value}` as 'enums.grade_category.leaf');
  if (type.kind === 'time') return <span className="whitespace-nowrap tabular-nums">{value}</span>;
  return value;
}
