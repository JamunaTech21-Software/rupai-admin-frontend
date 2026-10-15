import { useState } from 'react';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { todayIn } from '@/lib/dates';
import { useTranslation } from '@/lib/i18n';
import { AsyncCombobox, Button, type ComboboxOption, DatePicker, Modal, Select, Textarea, toast } from '@/ui';

import { findUsers, useDelegate, useDocumentTypes } from '../api/delegations';

type Field = 'from' | 'to' | 'from_date' | 'to_date' | 'reason';
type Errors = Partial<Record<Field, string>>;

const ANY = 'any';

/** The server names its fields as the API does; the form keeps them under these. */
const FIELD_OF: Readonly<Record<string, Field>> = {
  from_user_id: 'from',
  to_user_id: 'to',
  valid_from: 'from_date',
  valid_to: 'to_date',
  reason: 'reason',
};

/** Bangladesh keeps one offset all year (no daylight saving), so a business date maps to fixed timestamps. */
const startOfDay = (date: string) => `${date}T00:00:00+06:00`;
const endOfDay = (date: string) => `${date}T23:59:59+06:00`;

/**
 * Hand over approval authority (P7 §11.1): from one user to another, for a period of at most 90 days, with a
 * reason, and optionally for one kind of document. It hands over approval only: the delegate decides only what
 * they already hold the permission for. The server's messages (circular, overlapping, too long) land on the field.
 */
export function DelegationFormModal({
  canPickType,
  onClose,
  onRefused,
}: {
  /** Whether the user may list document types (workflow.view); without it a delegation covers every type. */
  readonly canPickType: boolean;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('approvals');
  const delegate = useDelegate();
  const types = useDocumentTypes(canPickType);
  const [from, setFrom] = useState<ComboboxOption | null>(null);
  const [to, setTo] = useState<ComboboxOption | null>(null);
  const [documentType, setDocumentType] = useState(ANY);
  const [validFrom, setValidFrom] = useState<string | null>(todayIn());
  const [validTo, setValidTo] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const without = (field: Field): Errors =>
    Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field));

  function check(): Errors {
    const found: Errors = {};
    if (!from) found.from = t('delegations.form.fromRequired');
    if (!to) found.to = t('delegations.form.toRequired');
    if (from?.id === to?.id && from) found.to = t('delegations.form.sameUser');
    if (!validFrom) found.from_date = t('delegations.form.dateRequired');
    if (!validTo) found.to_date = t('delegations.form.dateRequired');
    else if (validFrom && validTo < validFrom) found.to_date = t('delegations.form.endBeforeStart');
    if (reason.trim().length < 5) found.reason = t('delegations.form.reasonShort');
    return found;
  }

  async function submit() {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0 || !from || !to || !validFrom || !validTo) return;
    try {
      await delegate.mutateAsync({
        fromUserId: from.id,
        toUserId: to.id,
        documentType: documentType === ANY ? null : documentType,
        validFrom: startOfDay(validFrom),
        validTo: endOfDay(validTo),
        reason: reason.trim(),
      });
      toast.success(t('delegations.form.done', { from: from.label, to: to.label }));
      onClose();
    } catch (error) {
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

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('delegations.form.title')}
      description={t('delegations.form.intro')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={delegate.isPending}>
            {t('dialog.cancel')}
          </Button>
          <Button
            isPending={delegate.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('delegations.form.confirm')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <AsyncCombobox
          label={t('delegations.form.from')}
          isRequired
          value={from}
          onChange={(value) => {
            setFrom(value);
            setErrors(without('from'));
          }}
          loadOptions={async ({ query, signal }) => ({ items: await findUsers(query, signal) })}
          {...(errors.from ? { error: errors.from } : {})}
        />
        <AsyncCombobox
          label={t('delegations.form.to')}
          isRequired
          value={to}
          onChange={(value) => {
            setTo(value);
            setErrors(without('to'));
          }}
          loadOptions={async ({ query, signal }) => ({ items: await findUsers(query, signal) })}
          {...(errors.to ? { error: errors.to } : {})}
        />
        <DatePicker
          label={t('delegations.form.validFrom')}
          isRequired
          value={validFrom}
          onChange={(value) => {
            setValidFrom(value);
            setErrors(without('from_date'));
          }}
          {...(errors.from_date ? { error: errors.from_date } : {})}
        />
        <DatePicker
          label={t('delegations.form.validTo')}
          hint={t('delegations.form.validToHint')}
          isRequired
          value={validTo}
          onChange={(value) => {
            setValidTo(value);
            setErrors(without('to_date'));
          }}
          {...(errors.to_date ? { error: errors.to_date } : {})}
        />
        {canPickType ? (
          <div className="sm:col-span-2">
            <Select
              label={t('delegations.form.type')}
              value={documentType}
              options={[
                { id: ANY, label: t('delegations.allTypes') },
                ...(types.data ?? []).map((type) => ({ id: type.key, label: type.label })),
              ]}
              onChange={(value) => {
                setDocumentType(value ?? ANY);
              }}
            />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Textarea
            label={t('delegations.form.reason')}
            isRequired
            value={reason}
            maxLength={500}
            rows={3}
            onChange={(value) => {
              setReason(value);
              setErrors(without('reason'));
            }}
            {...(errors.reason ? { error: errors.reason } : {})}
          />
        </div>
      </form>
    </Modal>
  );
}
