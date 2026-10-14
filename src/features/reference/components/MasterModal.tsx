import { type Control, type FieldValues } from 'react-hook-form';
import { z } from 'zod';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm, zDecimalString, zTimeOfDay } from '@/lib/forms';
import { type TFunction, useTranslation } from '@/lib/i18n';
import { Alert, Button, Checkbox, Input, Modal, NumberInput, Select, Textarea, TimeInput, toast } from '@/ui';

import { type MasterInput, type MasterRow, rowName, useCreateMaster, useUpdateMaster } from '../api/masters';
import { type MasterField, type MasterFieldName, type MasterType, type RefTarget } from '../masters';
import { useRefOptions } from './useRefOptions';

type FormValues = Record<string, unknown>;
type T = TFunction<'ref'>;

/** Stands for "no value" in a Select, whose options need a non-empty id. */
const NONE = 'none';

const HINTS: Partial<Record<MasterFieldName, true>> = {
  sort_order: true,
  conversion_factor: true,
  decimal_precision: true,
  half_day_hours: true,
  overtime_after_minutes: true,
  grace_minutes: true,
  end_time: true,
  dialling_code: true,
};

const labelOf = (t: T, field: MasterField) => t(`fields.${field.name}`);

/** The form's rule for one field, as the server would check it. */
function fieldSchema(t: T, field: MasterField): z.ZodType {
  const label = labelOf(t, field).toLowerCase();
  const required = t('form.required', { field: label });
  const { type } = field;
  switch (type.kind) {
    case 'text': {
      const { pattern } = type;
      const text = z
        .string()
        .trim()
        .max(type.max, t('form.tooLong', { max: type.max }));
      const filled = field.isRequired ? text.min(1, required) : text;
      if (!pattern) return filled;
      return filled.refine((value) => value === '' || pattern.test(value), {
        error:
          field.name === 'code' && type.max === 20
            ? t('form.codeFormat')
            : t('form.format', { field: label }),
      });
    }
    case 'decimal': {
      const decimal = zDecimalString(type.decimal, type.isPositive ? { positive: true } : { min: '0' });
      return z
        .string()
        .trim()
        .superRefine((value, ctx) => {
          if (value === '') {
            if (field.isRequired) ctx.addIssue({ code: 'custom', message: required });
            return;
          }
          const issue = decimal.safeParse(value).error?.issues[0];
          if (issue) ctx.addIssue({ code: 'custom', message: issue.message });
        });
    }
    case 'int': {
      const range = t('form.range', { min: type.min, max: type.max });
      return z.number().int(range).min(type.min, range).max(type.max, range).nullable();
    }
    case 'bool':
      return z.boolean();
    case 'enum':
    case 'ref':
      return field.isRequired ? z.string().min(1, t('form.choose', { field: label })) : z.string();
    case 'time':
      return field.isRequired ? zTimeOfDay() : z.union([z.null(), zTimeOfDay()]);
  }
}

/** A stored value as the form holds it. */
function toForm(field: MasterField, value: unknown): unknown {
  switch (field.type.kind) {
    case 'int':
      return typeof value === 'number' ? value : null;
    case 'bool':
      return value === true;
    case 'time':
      return typeof value === 'string' ? value : null;
    default:
      return typeof value === 'string' ? value : '';
  }
}

/** A form value as the API takes it: empty is null, or the field's fallback. */
function toApi(field: MasterField, value: unknown): string | number | boolean | null {
  const { type } = field;
  if (type.kind === 'bool') return value === true;
  if (type.kind === 'int') return typeof value === 'number' ? value : (field.fallback ?? null);
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  return type.kind === 'text' && type.isUpper ? text.toUpperCase() : text;
}

function RefSelect({
  to,
  field,
  label,
  value,
  onChange,
  error,
  isDisabled,
}: {
  readonly to: RefTarget;
  readonly field: MasterField;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | undefined;
  readonly isDisabled: boolean;
}) {
  const { t } = useTranslation('ref');
  const { options } = useRefOptions(to);
  // A value that is no longer active is not among the options: keep it selectable, by its number.
  const current = value !== '' && !options.some((option) => option.id === value);
  return (
    <Select
      label={label}
      isRequired={field.isRequired ?? false}
      isDisabled={isDisabled}
      value={value === '' ? (field.isRequired ? null : NONE) : value}
      options={[
        ...(field.isRequired
          ? []
          : [{ id: NONE, label: field.emptyMeans ? t(field.emptyMeans) : t('none') }]),
        ...(current ? [{ id: value, label: `#${value}` }] : []),
        ...options,
      ]}
      onChange={(next) => {
        onChange(next === null || next === NONE ? '' : next);
      }}
      {...(error ? { error } : {})}
    />
  );
}

/** One field of the form: the control that suits its type. */
function MasterFieldInput({
  control,
  field,
  isLocked,
}: {
  readonly control: Control<FormValues, unknown, FieldValues>;
  readonly field: MasterField;
  readonly isLocked: boolean;
}) {
  const { t } = useTranslation('ref');
  const bind = useFormField(control, field.name);
  const label = labelOf(t, field);
  const hint = HINTS[field.name] ? t(`hints.${field.name}` as 'hints.sort_order') : undefined;
  const common = {
    label,
    name: bind.name,
    onBlur: bind.onBlur,
    inputRef: bind.inputRef,
    isRequired: field.isRequired ?? false,
    ...(hint ? { hint } : {}),
    ...(bind.error ? { error: bind.error } : {}),
  };
  const text = typeof bind.value === 'string' ? bind.value : '';
  const { type } = field;

  switch (type.kind) {
    case 'text':
      return type.isLong ? (
        <Textarea {...common} className="sm:col-span-2" rows={2} value={text} onChange={bind.onChange} />
      ) : (
        <Input {...common} autoComplete="off" isReadOnly={isLocked} value={text} onChange={bind.onChange} />
      );
    case 'decimal':
      return (
        <Input
          {...common}
          autoComplete="off"
          inputMode="decimal"
          isReadOnly={isLocked}
          value={text}
          onChange={bind.onChange}
        />
      );
    case 'int':
      return (
        <NumberInput
          {...common}
          minValue={type.min}
          maxValue={type.max}
          value={typeof bind.value === 'number' ? bind.value : null}
          onChange={bind.onChange}
        />
      );
    case 'bool':
      return (
        <Checkbox
          className="sm:col-span-2"
          name={bind.name}
          onBlur={bind.onBlur}
          isSelected={bind.value === true}
          onChange={bind.onChange}
        >
          {label}
        </Checkbox>
      );
    case 'enum':
      return (
        <Select
          {...common}
          value={text === '' ? (field.isRequired ? null : NONE) : text}
          options={[
            ...(field.isRequired ? [] : [{ id: NONE, label: t('none') }]),
            ...type.values.map((value) => ({
              id: value,
              label: t(`enums.${field.name}.${value}` as 'enums.grade_category.leaf'),
            })),
          ]}
          onChange={(next) => {
            bind.onChange(next === null || next === NONE ? '' : next);
          }}
        />
      );
    case 'ref':
      return (
        <RefSelect
          to={type.to}
          field={field}
          label={label}
          value={text}
          onChange={bind.onChange}
          error={bind.error}
          isDisabled={isLocked}
        />
      );
    case 'time':
      return (
        <TimeInput
          {...common}
          value={typeof bind.value === 'string' ? bind.value : null}
          onChange={bind.onChange}
        />
      );
  }
}

/**
 * Add or edit a row of any reference master. The fields come from the master's descriptor. A system record
 * keeps its code, and a base unit keeps its category and its factor of 1: those inputs are locked.
 */
export function MasterModal({
  type,
  row,
  onClose,
  onRefused,
}: {
  readonly type: MasterType;
  /** null: a new row. */
  readonly row: MasterRow | null;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('ref');
  const one = t(`types.${type.key}.one`);
  const create = useCreateMaster(type);
  const update = useUpdateMaster(type, row ?? { id: '', version: 0 }, row ? rowName(row) : one);
  const fields = type.fields.filter((field) => !field.isReadOnly);
  const isSystem = type.hasSystem && row?.is_system === true;
  const isBaseUnit = type.key === 'uom' && row?.is_base === true;
  const isLocked = (field: MasterField) =>
    (isSystem && field.name === type.keyField) ||
    (isBaseUnit && (field.name === 'uom_category_id' || field.name === 'conversion_factor'));

  const schema = z.object(
    Object.fromEntries(fields.map((field) => [field.name, fieldSchema(t, field)])),
  ) as z.ZodType<FormValues, FormValues>;
  const form = useZodForm(schema, {
    defaultValues: Object.fromEntries(fields.map((field) => [field.name, toForm(field, row?.[field.name])])),
  });

  const submit = form.handleSubmit(async (values) => {
    const input: MasterInput = Object.fromEntries(
      fields
        .filter((field) => !isLocked(field))
        .map((field) => [field.name, toApi(field, values[field.name])]),
    );
    try {
      const saved = row ? await update.mutateAsync(input) : await create.mutateAsync(input);
      toast.success(t(row ? 'form.saved' : 'form.created', { name: rowName(saved) }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        if (applyServerErrors(form, error.fieldErrors).length === 0) return;
      }
      onRefused(error);
    }
  });

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row ? t('form.editTitle', { name: rowName(row) }) : t('form.newTitle', { type: one })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('form.cancel')}
          </Button>
          <Button
            isPending={create.isPending || update.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {row ? t('form.save') : t('form.create')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        {isSystem ? (
          <Alert tone="info" className="sm:col-span-2">
            {t('form.systemNote')}
          </Alert>
        ) : null}
        {isBaseUnit ? (
          <Alert tone="info" className="sm:col-span-2">
            {t('form.baseUnitNote')}
          </Alert>
        ) : null}
        {fields.map((field) => (
          <MasterFieldInput
            key={field.name}
            control={form.control}
            field={field}
            isLocked={isLocked(field)}
          />
        ))}
      </form>
    </Modal>
  );
}
