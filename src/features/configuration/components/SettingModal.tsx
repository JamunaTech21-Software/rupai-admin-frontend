import { useWatch } from 'react-hook-form';
import { z } from 'zod';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { type TFunction, useTranslation } from '@/lib/i18n';
import {
  Alert,
  Button,
  Checkbox,
  DescriptionList,
  Input,
  Modal,
  NumberInput,
  RadioGroup,
  Select,
  Switch,
  Textarea,
  toast,
} from '@/ui';

import {
  type Setting,
  SETTING_TYPES,
  type SettingType,
  type SettingValue,
  useCreateSetting,
  useUpdateSetting,
} from '../api/settings';

type T = TFunction<'config'>;

/** What happens to an encrypted value on save: it is never shown, so it is kept, replaced or cleared. */
const SECRET_ACTIONS = ['keep', 'replace', 'clear'] as const;
type SecretAction = (typeof SECRET_ACTIONS)[number];

const KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const GROUP = /^[a-z][a-z0-9_]{0,49}$/;
const DECIMAL = /^-?\d{1,30}(\.\d{1,10})?$/;

interface Values {
  key: string;
  value_type: SettingType;
  is_encrypted: boolean;
  group: string;
  description: string;
  /** string, decimal and json values, as typed. */
  text: string;
  /** integer values. */
  number: number | null;
  /** boolean values. */
  flag: boolean;
  secret: SecretAction;
}

/** The value the form holds for its type, as the API takes it; empty is "not set" (null). */
function valueOf(values: Values): SettingValue {
  switch (values.value_type) {
    case 'boolean':
      return values.flag;
    case 'integer':
      return values.number;
    case 'json':
      return values.text.trim() === '' ? null : (JSON.parse(values.text) as SettingValue);
    case 'decimal':
      return values.text.trim() === '' ? null : values.text.trim();
    case 'string':
      return values.text === '' ? null : values.text;
  }
}

function schemaFor(t: T, row: Setting | null) {
  return z
    .object({
      key: z.string().trim(),
      value_type: z.enum(SETTING_TYPES),
      is_encrypted: z.boolean(),
      group: z.string().trim(),
      description: z
        .string()
        .trim()
        .max(500, t('settings.form.tooLong', { max: 500 })),
      text: z.string(),
      number: z.number().nullable(),
      flag: z.boolean(),
      secret: z.enum(SECRET_ACTIONS),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof Values, message: string) => {
        ctx.addIssue({ code: 'custom', path: [path], message });
      };
      if (!row) {
        if (values.key === '') issue('key', t('settings.form.keyRequired'));
        else if (values.key.length > 100 || !KEY.test(values.key)) issue('key', t('settings.form.keyFormat'));
        if (values.group !== '' && !GROUP.test(values.group)) issue('group', t('settings.form.groupFormat'));
      } else if (!GROUP.test(values.group)) {
        issue(
          'group',
          values.group === '' ? t('settings.form.groupRequired') : t('settings.form.groupFormat'),
        );
      }
      const writing = !row?.is_encrypted || values.secret === 'replace';
      if (!writing) return;
      const text = values.text.trim();
      // A replaced secret must be something: clearing it is its own choice.
      const mustFill = row?.is_encrypted === true;
      switch (values.value_type) {
        case 'string':
          if (mustFill && values.text === '') issue('text', t('settings.form.valueRequired'));
          else if (values.text.length > 10_000) issue('text', t('settings.form.tooLong', { max: 10_000 }));
          break;
        case 'integer':
          if (values.number === null) {
            if (mustFill) issue('number', t('settings.form.valueRequired'));
          } else if (!Number.isSafeInteger(values.number)) issue('number', t('settings.form.integer'));
          break;
        case 'decimal':
          if (text === '') {
            if (mustFill) issue('text', t('settings.form.valueRequired'));
          } else if (!DECIMAL.test(text)) issue('text', t('settings.form.decimal'));
          break;
        case 'json':
          if (text === '') {
            if (mustFill) issue('text', t('settings.form.valueRequired'));
            break;
          }
          try {
            JSON.parse(text);
          } catch {
            issue('text', t('settings.form.json'));
          }
          if (text.length > 20_000) issue('text', t('settings.form.tooLong', { max: 20_000 }));
          break;
        case 'boolean':
          break;
      }
    });
}

/** The stored value as the form edits it. */
function formValues(row: Setting | null): Values {
  const value = row?.value;
  const type = row?.value_type ?? 'string';
  return {
    key: row?.key ?? '',
    value_type: type,
    is_encrypted: row?.is_encrypted ?? false,
    group: row?.group ?? '',
    description: row?.description ?? '',
    text:
      value === null || value === undefined || row?.is_encrypted
        ? ''
        : type === 'json'
          ? JSON.stringify(value, null, 2)
          : typeof value === 'string'
            ? value
            : '',
    number: typeof value === 'number' ? value : null,
    flag: value === true,
    secret: 'keep',
  };
}

/**
 * Add a setting, or change one's value, group and description. Key, type and encryption are fixed when it is
 * added. The value input follows the type; an encrypted value is never shown, so editing one means keeping,
 * replacing or clearing it.
 */
export function SettingModal({
  row,
  onClose,
  onRefused,
}: {
  /** null: a new setting. */
  readonly row: Setting | null;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('config');
  const create = useCreateSetting();
  const update = useUpdateSetting(row ?? { id: '', version: 0, key: '' });
  const form = useZodForm(schemaFor(t, row), { defaultValues: formValues(row) });
  const key = useFormField(form.control, 'key');
  const type = useFormField(form.control, 'value_type');
  const group = useFormField(form.control, 'group');
  const description = useFormField(form.control, 'description');
  const text = useFormField(form.control, 'text');
  const number = useFormField(form.control, 'number');
  const values = useWatch({ control: form.control }) as Partial<Values>;
  const valueType = values.value_type ?? 'string';
  const encrypted = values.is_encrypted === true;
  const secret = values.secret ?? 'keep';
  const showValue = !row?.is_encrypted || secret === 'replace';

  const submit = form.handleSubmit(async (input) => {
    try {
      if (row) {
        const keepValue = row.is_encrypted && input.secret === 'keep';
        const saved = await update.mutateAsync({
          group: input.group,
          description: input.description === '' ? null : input.description,
          ...(keepValue
            ? {}
            : { value: input.secret === 'clear' && row.is_encrypted ? null : valueOf(input) }),
        });
        toast.success(t('settings.form.saved', { key: saved.key }));
      } else {
        const saved = await create.mutateAsync({
          key: input.key,
          value_type: input.value_type,
          is_encrypted: input.is_encrypted,
          ...(input.group === '' ? {} : { group: input.group }),
          value: valueOf(input),
          description: input.description === '' ? null : input.description,
        });
        toast.success(t('settings.form.created', { key: saved.key }));
      }
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        // The server names the value "value"; the form holds it in the input for its type.
        const field = valueType === 'integer' ? 'number' : valueType === 'boolean' ? 'flag' : 'text';
        const details = error.fieldErrors.map((d) => (d.field === 'value' ? { ...d, field } : d));
        if (applyServerErrors(form, details).length === 0) return;
      }
      onRefused(error);
    }
  });

  const valueLabel = row?.is_encrypted ? t('settings.form.newValue') : t('settings.fields.value');
  const valueHint =
    row?.is_encrypted || valueType === 'boolean' ? undefined : t('settings.form.emptyIsUnset');
  const common = (bind: { name: string; onBlur: () => void; error: string | undefined }) => ({
    label: valueLabel,
    name: bind.name,
    onBlur: bind.onBlur,
    ...(valueHint ? { hint: valueHint } : {}),
    ...(bind.error ? { error: bind.error } : {}),
  });

  const valueInput = (() => {
    switch (valueType) {
      case 'boolean':
        return (
          <Switch
            className="sm:col-span-2"
            isSelected={values.flag === true}
            onChange={(on) => {
              form.setValue('flag', on, { shouldDirty: true });
            }}
          >
            {valueLabel}
          </Switch>
        );
      case 'integer':
        return (
          <NumberInput
            {...common(number)}
            inputRef={number.inputRef}
            formatOptions={{ maximumFractionDigits: 0 }}
            value={number.value}
            onChange={number.onChange}
          />
        );
      case 'json':
        return (
          <Textarea
            {...common(text)}
            className="font-mono sm:col-span-2"
            rows={6}
            inputRef={text.inputRef}
            value={text.value}
            onChange={text.onChange}
          />
        );
      case 'decimal':
        return (
          <Input
            {...common(text)}
            inputMode="decimal"
            autoComplete="off"
            inputRef={text.inputRef}
            value={text.value}
            onChange={text.onChange}
          />
        );
      case 'string':
        return (
          <Input
            {...common(text)}
            className="sm:col-span-2"
            autoComplete="off"
            {...(encrypted ? { type: 'password' as const } : {})}
            inputRef={text.inputRef}
            value={text.value}
            onChange={text.onChange}
          />
        );
    }
  })();

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row ? t('settings.form.editTitle', { key: row.key }) : t('settings.form.newTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          <Button
            isPending={create.isPending || update.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {row ? t('save') : t('settings.form.create')}
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
        {row ? (
          <DescriptionList
            className="sm:col-span-2"
            columns={3}
            items={[
              { term: t('settings.fields.key'), description: <code className="font-mono">{row.key}</code> },
              { term: t('settings.fields.value_type'), description: t(`settings.types.${row.value_type}`) },
              {
                term: t('settings.fields.is_encrypted'),
                description: row.is_encrypted ? t('settings.yes') : t('settings.no'),
              },
            ]}
          />
        ) : (
          <>
            <Input
              label={t('settings.fields.key')}
              hint={t('settings.form.keyHint')}
              isRequired
              autoComplete="off"
              className="sm:col-span-2"
              name={key.name}
              value={key.value}
              onChange={key.onChange}
              onBlur={key.onBlur}
              inputRef={key.inputRef}
              {...(key.error ? { error: key.error } : {})}
            />
            <Select
              label={t('settings.fields.value_type')}
              hint={t('settings.form.fixedHint')}
              isRequired
              value={type.value}
              options={SETTING_TYPES.map((v) => ({ id: v, label: t(`settings.types.${v}`) }))}
              onChange={(next) => {
                if (next) type.onChange(next as SettingType);
              }}
            />
            <div className="flex items-end pb-2">
              <Checkbox
                isSelected={encrypted}
                onChange={(on) => {
                  form.setValue('is_encrypted', on, { shouldDirty: true });
                }}
              >
                {t('settings.form.encrypt')}
              </Checkbox>
            </div>
            {encrypted ? (
              <Alert tone="warning" className="sm:col-span-2">
                {t('settings.form.encryptNote')}
              </Alert>
            ) : null}
          </>
        )}
        {row?.is_encrypted ? (
          <RadioGroup
            className="sm:col-span-2"
            label={t('settings.form.storedValue')}
            hint={row.has_value ? t('settings.form.storedHint') : t('settings.form.noStoredHint')}
            value={secret}
            options={SECRET_ACTIONS.filter((a) => a !== 'clear' || row.has_value).map((a) => ({
              id: a,
              label: t(`settings.form.secret.${a}`),
            }))}
            onChange={(next) => {
              form.setValue('secret', next as SecretAction, { shouldDirty: true });
            }}
          />
        ) : null}
        {showValue ? valueInput : null}
        <Input
          label={t('settings.fields.group')}
          {...(row ? {} : { hint: t('settings.form.groupHint') })}
          isRequired={row !== null}
          autoComplete="off"
          name={group.name}
          value={group.value}
          onChange={group.onChange}
          onBlur={group.onBlur}
          inputRef={group.inputRef}
          {...(group.error ? { error: group.error } : {})}
        />
        <Textarea
          label={t('settings.fields.description')}
          className="sm:col-span-2"
          rows={2}
          name={description.name}
          value={description.value}
          onChange={description.onChange}
          onBlur={description.onBlur}
          inputRef={description.inputRef}
          {...(description.error ? { error: description.error } : {})}
        />
      </form>
    </Modal>
  );
}
