import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import {
  Alert,
  AsyncCombobox,
  Button,
  Checkbox,
  type ComboboxOption,
  Input,
  Modal,
  NumberInput,
  Select,
  Switch,
  Textarea,
  toast,
} from '@/ui';

import { findUsers, useRoleChoices } from '../api/choices';
import {
  CHANNELS,
  type Channel,
  RECIPIENT_RULES,
  type RecipientRule,
  type Rule,
  type RuleBody,
  SEVERITIES,
  type Severity,
  TRIGGER_TYPES,
  type TriggerType,
  useCreateRule,
  useTriggers,
  useUpdateRule,
} from '../api/notifications';

type Field = 'code' | 'trigger' | 'name' | 'lead_days' | 'recipient' | 'role' | 'user' | 'condition';
type Errors = Partial<Record<Field, string>>;

/** The server names its fields as the API does; the form keeps them under these. */
const FIELD_OF: Readonly<Record<string, Field>> = {
  code: 'code',
  trigger_type: 'trigger',
  name: 'name',
  lead_days: 'lead_days',
  recipient_rule: 'recipient',
  role_id: 'role',
  user_id: 'user',
  condition: 'condition',
};

const without = (errors: Errors, field: Field): Errors =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field));

const listOf = (text: string): string[] =>
  text
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part !== '');

/**
 * Add a notification rule (notification.create) or change one (notification.edit): which event it watches, who is
 * told (the approvers, a role, people in scope, a named person), how soon before a date, by which channel and how
 * seriously. A rule's code and event are fixed once it exists, and a rule is never deleted, only switched off. An
 * event whose module does not exist yet can be set up, and says when it starts to work.
 */
export function RuleFormModal({
  rule,
  onClose,
  onRefused,
}: {
  /** The rule being changed; none to add one. */
  readonly rule: Rule | null;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('notifications');
  const triggers = useTriggers();
  const roles = useRoleChoices();
  const create = useCreateRule();
  const update = useUpdateRule(rule ?? { id: '', version: 0, name: '' });

  const [code, setCode] = useState('');
  const [trigger, setTrigger] = useState<TriggerType | ''>(rule?.trigger_type ?? '');
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [leadDays, setLeadDays] = useState<number | null>(rule?.lead_days ?? null);
  const [recipient, setRecipient] = useState<RecipientRule | ''>(rule?.recipient_rule ?? '');
  const [roleId, setRoleId] = useState(rule?.role?.id ?? '');
  const [user, setUser] = useState<ComboboxOption | null>(
    rule?.user ? { id: rule.user.id, label: rule.user.username } : null,
  );
  const [channel, setChannel] = useState<Channel>(rule?.channel ?? 'in_app');
  const [severity, setSeverity] = useState<Severity>(rule?.severity ?? 'info');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [typeCodes, setTypeCodes] = useState(
    Array.isArray(rule?.condition?.document_type_codes)
      ? (rule.condition.document_type_codes as string[]).join(', ')
      : '',
  );
  const [notifyNext, setNotifyNext] = useState(rule?.condition?.notify_next_step_approvers !== false);
  const [errors, setErrors] = useState<Errors>({});

  const definition = triggers.data?.find((candidate) => candidate.key === trigger);
  const isPending = create.isPending || update.isPending;

  function check(): Errors {
    const found: Errors = {};
    if (!rule && code.trim() === '') found.code = t('rules.form.codeRequired');
    if (!rule && trigger === '') found.trigger = t('rules.form.triggerRequired');
    if (name.trim() === '') found.name = t('rules.form.nameRequired');
    if (recipient === '') found.recipient = t('rules.form.recipientRequired');
    if (recipient === 'by_role' && roleId === '') found.role = t('rules.form.roleRequired');
    if (recipient === 'by_named_user' && !user) found.user = t('rules.form.userRequired');
    if (definition?.uses_lead_days && leadDays === null) found.lead_days = t('rules.form.leadRequired');
    return found;
  }

  function body(): RuleBody {
    let condition: Record<string, unknown> | null = null;
    if (trigger === 'document_expiry' && typeCodes.trim() !== '')
      condition = { document_type_codes: listOf(typeCodes) };
    if (trigger === 'approval_unresolved') condition = { notify_next_step_approvers: notifyNext };
    return {
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      condition,
      lead_days: definition?.uses_lead_days ? leadDays : null,
      recipient_rule: recipient as RecipientRule,
      role_id: recipient === 'by_role' ? roleId : null,
      user_id: recipient === 'by_named_user' ? (user?.id ?? null) : null,
      channel,
      severity,
      is_active: isActive,
    };
  }

  async function submit() {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      if (rule) await update.mutateAsync(body());
      else await create.mutateAsync({ ...body(), code: code.trim(), trigger_type: trigger as TriggerType });
      toast.success(t(rule ? 'rules.form.saved' : 'rules.form.created', { name: name.trim() }));
      onClose();
    } catch (error) {
      if (errorBehaviour(error) === 'conflict') {
        onClose();
        return;
      }
      if (isApiError(error) && errorBehaviour(error) === 'field-errors') {
        const placed: Errors = {};
        let rest = false;
        for (const detail of error.fieldErrors) {
          const field = detail.field ? FIELD_OF[detail.field] : undefined;
          if (field) placed[field] = detail.message;
          else rest = true;
        }
        if (Object.keys(placed).length > 0) {
          setErrors(placed);
          if (!rest) return;
        }
      }
      onRefused(error);
      onClose();
    }
  }

  const allowed = definition?.recipient_rules ?? RECIPIENT_RULES;

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={rule ? t('rules.form.editTitle', { name: rule.name }) : t('rules.form.addTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={isPending}>
            {t('rules.form.cancel')}
          </Button>
          <Button
            isPending={isPending}
            onPress={() => {
              void submit();
            }}
          >
            {rule ? t('rules.form.save') : t('rules.form.add')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t('rules.form.code')}
          hint={t('rules.form.codeHint')}
          isRequired={!rule}
          isDisabled={rule !== null}
          value={rule ? rule.code : code}
          maxLength={40}
          onChange={(value) => {
            setCode(value);
            setErrors(without(errors, 'code'));
          }}
          {...(errors.code ? { error: errors.code } : {})}
        />
        <Select
          label={t('rules.form.trigger')}
          isRequired={!rule}
          isDisabled={rule !== null}
          value={trigger === '' ? null : trigger}
          options={TRIGGER_TYPES.map((key) => ({
            id: key,
            label: triggers.data?.find((candidate) => candidate.key === key)?.label ?? key,
          }))}
          onChange={(value) => {
            const next = TRIGGER_TYPES.find((candidate) => candidate === value) ?? '';
            setTrigger(next);
            // The new event may not allow the recipient chosen.
            setRecipient('');
            setErrors(without(errors, 'trigger'));
          }}
          {...(errors.trigger ? { error: errors.trigger } : {})}
        />
        {definition ? (
          <div className="sm:col-span-2">
            <Alert tone={definition.evaluated ? 'info' : 'warning'} title={definition.label}>
              <span className="block">{definition.description}</span>
              {definition.evaluated ? null : (
                <span className="mt-1 block font-medium">
                  {t('rules.form.notActive', { module: definition.arrives_with ?? '' })}
                </span>
              )}
            </Alert>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Input
            label={t('rules.form.name')}
            isRequired
            value={name}
            maxLength={150}
            onChange={(value) => {
              setName(value);
              setErrors(without(errors, 'name'));
            }}
            {...(errors.name ? { error: errors.name } : {})}
          />
        </div>
        <div className="sm:col-span-2">
          <Textarea
            label={t('rules.form.description')}
            value={description}
            maxLength={500}
            rows={2}
            onChange={setDescription}
          />
        </div>
        <Select
          label={t('rules.form.recipient')}
          isRequired
          value={recipient === '' ? null : recipient}
          options={allowed.map((option) => ({ id: option, label: t(`recipients.${option}`) }))}
          onChange={(value) => {
            setRecipient(RECIPIENT_RULES.find((candidate) => candidate === value) ?? '');
            setErrors(without(errors, 'recipient'));
          }}
          {...(errors.recipient ? { error: errors.recipient } : {})}
        />
        {recipient === 'by_role' ? (
          <Select
            label={t('rules.form.role')}
            isRequired
            value={roleId === '' ? null : roleId}
            options={(roles.data ?? []).map((role) => ({ id: role.id, label: role.name }))}
            onChange={(value) => {
              setRoleId(value ?? '');
              setErrors(without(errors, 'role'));
            }}
            {...(errors.role ? { error: errors.role } : {})}
          />
        ) : null}
        {recipient === 'by_named_user' ? (
          <AsyncCombobox
            label={t('rules.form.user')}
            isRequired
            value={user}
            onChange={(value) => {
              setUser(value);
              setErrors(without(errors, 'user'));
            }}
            loadOptions={async ({ query, signal }) => ({ items: await findUsers(query, signal) })}
            {...(errors.user ? { error: errors.user } : {})}
          />
        ) : null}
        {definition?.uses_lead_days ? (
          <NumberInput
            label={t('rules.form.leadDays')}
            hint={t('rules.form.leadDaysHint')}
            isRequired
            minValue={0}
            maxValue={365}
            value={leadDays}
            onChange={(value) => {
              setLeadDays(value);
              setErrors(without(errors, 'lead_days'));
            }}
            {...(errors.lead_days ? { error: errors.lead_days } : {})}
          />
        ) : null}
        <Select
          label={t('rules.form.channel')}
          value={channel}
          options={CHANNELS.map((option) => ({ id: option, label: t(`channels.${option}`) }))}
          onChange={(value) => {
            setChannel(CHANNELS.find((candidate) => candidate === value) ?? 'in_app');
          }}
        />
        <Select
          label={t('rules.form.severity')}
          value={severity}
          options={SEVERITIES.map((option) => ({ id: option, label: t(`severity.${option}`) }))}
          onChange={(value) => {
            setSeverity(SEVERITIES.find((candidate) => candidate === value) ?? 'info');
          }}
        />
        {trigger === 'document_expiry' ? (
          <div className="sm:col-span-2">
            <Input
              label={t('rules.form.typeCodes')}
              hint={t('rules.form.typeCodesHint')}
              value={typeCodes}
              onChange={setTypeCodes}
              {...(errors.condition ? { error: errors.condition } : {})}
            />
          </div>
        ) : null}
        {trigger === 'approval_unresolved' ? (
          <div className="sm:col-span-2">
            <Checkbox isSelected={notifyNext} onChange={setNotifyNext}>
              {t('rules.form.notifyNext')}
            </Checkbox>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Switch isSelected={isActive} onChange={setIsActive}>
            {t('rules.form.active')}
          </Switch>
        </div>
      </form>
    </Modal>
  );
}
