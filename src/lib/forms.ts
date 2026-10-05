import { zodResolver } from '@hookform/resolvers/zod';
import { type Ref } from 'react';
import {
  type Control,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
  useController,
  useForm,
} from 'react-hook-form';
import { z } from 'zod';

import { isBusinessDate, isTimeOfDay } from './dates';
import { t } from './i18n';
import { DECIMAL_KINDS, type DecimalKind, Dec, isDecimalString } from './money';

/**
 * React Hook Form + Zod integration (F0.04, Spec P5 §10.2): one way to build forms, with client validation,
 * server field errors placed on the right input, and focus on the first error.
 */

/** A form validated by a Zod schema. Errors show after a field is touched, and focus goes to the first error. */
export function useZodForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, 'resolver'> = {},
): UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>> {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    // zodResolver infers loose FieldValues for a generic schema; the schema fixes the real input/output types.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<TSchema>, unknown, z.output<TSchema>>,
    mode: 'onTouched',
    shouldFocusError: true,
    ...options,
  });
}

/** What every ui form control accepts: spread it onto the control. */
export interface FieldBinding<TValue> {
  readonly name: string;
  readonly value: TValue;
  /** Controls report an empty value as null; the schema turns that into the field's "required" message. */
  readonly onChange: (value: TValue | null) => void;
  readonly onBlur: () => void;
  readonly inputRef: Ref<HTMLElement>;
  readonly error: string | undefined;
  readonly isDisabled: boolean | undefined;
}

/**
 * Connects one field of a form to a ui control:
 * `<MoneyInput label="Rate" {...useFormField(form.control, 'rate')} />`.
 */
export function useFormField<TValues extends FieldValues, TName extends FieldPath<TValues>>(
  control: Control<TValues, unknown, FieldValues>,
  name: TName,
): FieldBinding<FieldPathValue<TValues, TName>> {
  const { field, fieldState } = useController({ control, name });
  return {
    name: field.name,
    value: field.value,
    onChange: field.onChange,
    onBlur: field.onBlur,
    inputRef: field.ref,
    error: fieldState.error?.message,
    isDisabled: field.disabled,
  };
}

/** One detail of the backend's error envelope (backend/src/core/errors/app-error.ts ErrorDetail). */
export interface ApiErrorDetail {
  /** Dot and index notation matching the request body, e.g. `lines.0.quantity`. */
  readonly field?: string;
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Puts the server's field errors on the matching inputs (`lines.0.quantity` lands on that line's quantity) and
 * focuses the first one. Returns the details that name no field, for an Alert above the form.
 */
export function applyServerErrors<TValues extends FieldValues>(
  form: Pick<UseFormReturn<TValues, unknown, FieldValues>, 'setError'>,
  details: readonly ApiErrorDetail[],
): ApiErrorDetail[] {
  const unplaced: ApiErrorDetail[] = [];
  let focused = false;
  for (const detail of details) {
    if (!detail.field) {
      unplaced.push(detail);
      continue;
    }
    form.setError(
      detail.field as FieldPath<TValues>,
      { type: 'server', message: detail.message },
      { shouldFocus: !focused },
    );
    focused = true;
  }
  return unplaced;
}

// ---- Zod schemas for domain values ---------------------------------------------------------------------

interface DecimalSchemaOptions {
  readonly min?: string;
  readonly max?: string;
  readonly positive?: boolean;
  /** Places allowed in this field (defaults to the kind's scale). */
  readonly scale?: number;
}

/**
 * A decimal string of the given kind, validated with decimal arithmetic and kept as a string for the API.
 * Mirrors the backend's zDecimal, so the client refuses what the server would refuse.
 */
export function zDecimalString(kind: DecimalKind, options: DecimalSchemaOptions = {}) {
  const { intDigits } = DECIMAL_KINDS[kind];
  const scale = options.scale ?? DECIMAL_KINDS[kind].scale;
  return z.string({ error: () => t('forms:enterAmount') }).superRefine((value, ctx) => {
    if (!isDecimalString(value)) {
      ctx.addIssue({ code: 'custom', message: t('forms:amountFormat') });
      return;
    }
    const [intPart = '', frac = ''] = value.replace('-', '').split('.');
    if (frac.length > scale) ctx.addIssue({ code: 'custom', message: t('forms:maxPlaces', { scale }) });
    if (intPart.replace(/^0+(?=\d)/, '').length > intDigits) {
      ctx.addIssue({ code: 'custom', message: t('forms:tooLarge') });
    }
    const d = new Dec(value);
    if (options.positive && !d.gt(0)) ctx.addIssue({ code: 'custom', message: t('forms:positive') });
    if (options.min !== undefined && d.lt(options.min)) {
      ctx.addIssue({ code: 'custom', message: t('forms:atLeast', { min: options.min }) });
    }
    if (options.max !== undefined && d.gt(options.max)) {
      ctx.addIssue({ code: 'custom', message: t('forms:atMost', { max: options.max }) });
    }
  });
}

/** A money amount (2 places by default, as entered by people). */
export const zMoney = (options: DecimalSchemaOptions = {}) =>
  zDecimalString('money', { scale: 2, ...options });

/** A quantity in kg (3 places). */
export const zQuantity = (options: DecimalSchemaOptions = {}) => zDecimalString('qty', options);

/** A business date `YYYY-MM-DD`. */
export const zBusinessDate = () =>
  z
    .string({ error: () => t('forms:chooseDate') })
    .refine(isBusinessDate, { error: () => t('forms:validDate') });

/** A time of day `HH:mm`. */
export const zTimeOfDay = () =>
  z.string({ error: () => t('forms:enterTime') }).refine(isTimeOfDay, { error: () => t('forms:validTime') });
