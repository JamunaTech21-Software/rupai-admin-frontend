import { useTranslation } from '@/lib/i18n';
import { Button, IconButton, Input, Select } from '@/ui';

import { type DocumentType } from '../api/workflows';
import { type ConditionDraft, isFlagOperator } from './draft';

/**
 * One test on one field of the document: the field (from the document type), the operator that field allows, and the
 * value. Amounts and quantities are typed as decimals; a list is typed with commas; a flag has no value. The
 * server checks the rest and names the problem on this condition.
 */
export function ConditionEditor({
  condition,
  fields,
  label,
  error,
  onChange,
  onRemove,
}: {
  readonly condition: ConditionDraft;
  readonly fields: DocumentType['fields'];
  /** Names the controls for a screen reader: "Step 2 condition". */
  readonly label: string;
  readonly error?: string | undefined;
  readonly onChange: (next: ConditionDraft) => void;
  readonly onRemove: () => void;
}) {
  const { t } = useTranslation('workflows');
  const field = fields.find((candidate) => candidate.name === condition.field);
  const numeric = field?.class === 'amount' || field?.class === 'quantity';
  const operators = field?.operators ?? [];

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-subtle p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem_1fr_auto] sm:items-end">
        <Select
          label={t('condition.field', { label })}
          value={condition.field === '' ? null : condition.field}
          placeholder={t('condition.pickField')}
          options={fields.map((candidate) => ({ id: candidate.name, label: candidate.label }))}
          onChange={(value) => {
            const picked = fields.find((candidate) => candidate.name === value);
            // Keep the operator if the new field allows it; otherwise start again.
            const keep = condition.operator !== '' && picked?.operators.includes(condition.operator);
            onChange({
              ...condition,
              field: value ?? '',
              operator: keep ? condition.operator : (picked?.operators[0] ?? ''),
            });
          }}
        />
        <Select
          label={t('condition.operator', { label })}
          value={condition.operator === '' ? null : condition.operator}
          isDisabled={!field}
          options={operators.map((operator) => ({ id: operator, label: t(`operators.${operator}`) }))}
          onChange={(value) => {
            const operator = operators.find((candidate) => candidate === value) ?? '';
            onChange({ ...condition, operator });
          }}
        />
        {isFlagOperator(condition.operator) || condition.operator === '' ? (
          <span />
        ) : condition.operator === 'between' ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label={t('condition.lower', { label })}
              value={condition.value}
              inputMode="decimal"
              onChange={(value) => {
                onChange({ ...condition, value });
              }}
            />
            <Input
              label={t('condition.upper', { label })}
              value={condition.upper}
              inputMode="decimal"
              onChange={(value) => {
                onChange({ ...condition, upper: value });
              }}
            />
          </div>
        ) : (
          <Input
            label={t('condition.value', { label })}
            value={condition.value}
            {...(numeric ? { inputMode: 'decimal' as const } : {})}
            {...(condition.operator === 'in' || condition.operator === 'not_in'
              ? { hint: t('condition.listHint') }
              : {})}
            onChange={(value) => {
              onChange({ ...condition, value });
            }}
          />
        )}
        <IconButton
          icon="trash"
          variant="ghost"
          label={t('condition.remove', { label })}
          onPress={onRemove}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** "Add a condition" under a list of them. */
export function AddConditionButton({
  onPress,
  label,
}: {
  readonly onPress: () => void;
  readonly label: string;
}) {
  return (
    <Button variant="secondary" size="sm" iconStart="plus" onPress={onPress}>
      {label}
    </Button>
  );
}
