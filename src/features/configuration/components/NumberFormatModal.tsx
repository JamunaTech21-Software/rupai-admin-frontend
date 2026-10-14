import { useWatch } from 'react-hook-form';
import { z } from 'zod';

import { todayIn } from '@/lib/dates';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Checkbox, Input, Modal, NumberInput, Select, toast } from '@/ui';

import {
  COMPONENT_FIELD,
  type NumberFormat,
  type NumberFormatInput,
  RESET_FREQUENCIES,
  SEPARATORS,
  useUpdateNumberFormat,
} from '../api/numbering';
import { exampleNumber } from '../numbering';

/** A Select option needs a non-empty id: "no separator" travels as this. */
const NO_SEPARATOR = 'none';

/**
 * Edit how one document type's numbers look: prefix, the parts it carries, separator, width and reset. Only
 * the parts the document can supply are offered. The example under the form follows every change; the change
 * applies to numbers allocated after it is saved.
 */
export function NumberFormatModal({
  format,
  onClose,
  onRefused,
}: {
  readonly format: NumberFormat;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('config');
  const update = useUpdateNumberFormat(format);

  const schema = z.object({
    prefix: z
      .string()
      .trim()
      .min(1, t('numbering.form.prefixRequired'))
      .regex(/^[A-Za-z0-9]{1,20}$/, t('numbering.form.prefixFormat')),
    separator: z.enum(SEPARATORS),
    sequence_width: z
      .number(t('numbering.form.widthRange'))
      .int(t('numbering.form.widthRange'))
      .min(3, t('numbering.form.widthRange'))
      .max(12, t('numbering.form.widthRange')),
    reset_frequency: z.enum(RESET_FREQUENCIES),
    include_estate_code: z.boolean(),
    include_fiscal_year: z.boolean(),
    include_season: z.boolean(),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      prefix: format.prefix,
      separator: SEPARATORS.find((s) => s === format.separator) ?? '-',
      sequence_width: format.sequence_width,
      reset_frequency: format.reset_frequency,
      include_estate_code: format.include_estate_code,
      include_fiscal_year: format.include_fiscal_year,
      include_season: format.include_season,
    },
  });
  const prefix = useFormField(form.control, 'prefix');
  const separator = useFormField(form.control, 'separator');
  const width = useFormField(form.control, 'sequence_width');
  const reset = useFormField(form.control, 'reset_frequency');
  const values = useWatch({ control: form.control });

  const draft: NumberFormatInput = {
    prefix: (values.prefix ?? '').trim().toUpperCase() || format.prefix,
    separator: values.separator ?? '-',
    sequence_width: typeof values.sequence_width === 'number' ? values.sequence_width : format.sequence_width,
    reset_frequency: values.reset_frequency ?? format.reset_frequency,
    include_estate_code: values.include_estate_code ?? false,
    include_fiscal_year: values.include_fiscal_year ?? false,
    include_season: values.include_season ?? false,
  };
  const today = todayIn();

  const submit = form.handleSubmit(async (input) => {
    try {
      const saved = await update.mutateAsync({ ...input, prefix: input.prefix.toUpperCase() });
      toast.success(t('numbering.form.saved', { name: saved.label, example: saved.example }));
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
      title={t('numbering.form.title', { name: format.label })}
      description={t(format.is_gapless ? 'numbering.form.gaplessNote' : 'numbering.form.operationalNote')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            isPending={update.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('save')}
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
        <Input
          label={t('numbering.fields.prefix')}
          hint={t('numbering.form.prefixHint')}
          isRequired
          autoComplete="off"
          maxLength={20}
          name={prefix.name}
          value={prefix.value}
          onChange={prefix.onChange}
          onBlur={prefix.onBlur}
          inputRef={prefix.inputRef}
          {...(prefix.error ? { error: prefix.error } : {})}
        />
        <Select
          label={t('numbering.fields.separator')}
          isRequired
          value={separator.value === '' ? NO_SEPARATOR : separator.value}
          options={SEPARATORS.map((s) => ({
            id: s === '' ? NO_SEPARATOR : s,
            label: t(
              `numbering.separators.${s === '' ? 'none' : s === '-' ? 'hyphen' : s === '/' ? 'slash' : 'dot'}`,
            ),
          }))}
          onChange={(next) => {
            separator.onChange(
              next === NO_SEPARATOR ? '' : ((next ?? '-') as NumberFormatInput['separator']),
            );
          }}
          {...(separator.error ? { error: separator.error } : {})}
        />
        <NumberInput
          label={t('numbering.fields.sequence_width')}
          hint={t('numbering.form.widthHint')}
          isRequired
          minValue={3}
          maxValue={12}
          name={width.name}
          value={typeof width.value === 'number' ? width.value : null}
          onChange={width.onChange}
          onBlur={width.onBlur}
          inputRef={width.inputRef}
          {...(width.error ? { error: width.error } : {})}
        />
        <Select
          label={t('numbering.fields.reset_frequency')}
          isRequired
          value={reset.value}
          options={RESET_FREQUENCIES.map((r) => ({ id: r, label: t(`numbering.resets.${r}`) }))}
          onChange={(next) => {
            if (next) reset.onChange(next as NumberFormatInput['reset_frequency']);
          }}
          {...(reset.error ? { error: reset.error } : {})}
        />
        {format.available_components.length > 0 ? (
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium text-fg">{t('numbering.form.parts')}</legend>
            {format.available_components.map((component) => {
              const name = COMPONENT_FIELD[component];
              return (
                <Checkbox
                  key={component}
                  isSelected={values[name] === true}
                  onChange={(on) => {
                    form.setValue(name, on, { shouldDirty: true });
                  }}
                >
                  {t(`numbering.components.${component}`)}
                </Checkbox>
              );
            })}
          </fieldset>
        ) : (
          <p className="text-sm text-fg-muted sm:col-span-2">{t('numbering.form.noParts')}</p>
        )}
        <Alert tone="info" className="sm:col-span-2" title={t('numbering.form.example')}>
          <span className="font-mono break-all">{exampleNumber(draft, today)}</span>
          <span className="mt-1 block text-sm">{t('numbering.form.exampleNote')}</span>
        </Alert>
      </form>
    </Modal>
  );
}
