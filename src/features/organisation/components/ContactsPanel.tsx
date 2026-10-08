import { useState } from 'react';
import { z } from 'zod';

import { PageError, PageLoading } from '@/features/system';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Input, Modal, Select, toast } from '@/ui';

import {
  type ContactOwner,
  useContacts,
  useCreateContact,
  useDeleteContact,
  useMakePrimaryContact,
  useUpdateContact,
} from '../api/facilities';
import { type Contact, CONTACT_TYPES, PHONE } from '../api/schemas';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

function ContactModal({
  owner,
  contact,
  isFirst,
  onClose,
  onRefused,
}: {
  readonly owner: ContactOwner;
  readonly contact: Contact | null;
  readonly isFirst: boolean;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const create = useCreateContact(owner);
  const update = useUpdateContact(owner, contact ?? ({ id: '', version: 0 } as Contact));
  const phone = z.union([z.literal(''), z.string().trim().regex(PHONE, t('validation.phone'))]);
  const schema = z.object({
    contact_name: z
      .string()
      .trim()
      .min(1, t('validation.required', { field: t('contacts.name').toLowerCase() }))
      .max(150),
    designation: z.string().trim().max(100),
    contact_type: z.enum(CONTACT_TYPES),
    phone,
    phone_alt: phone,
    email: z.union([z.literal(''), z.email(t('validation.email')).max(150)]),
    is_primary: z.boolean(),
  });
  const form = useZodForm(schema, {
    defaultValues: {
      contact_name: contact?.contact_name ?? '',
      designation: contact?.designation ?? '',
      contact_type: contact?.contact_type ?? 'primary',
      phone: contact?.phone ?? '',
      phone_alt: contact?.phone_alt ?? '',
      email: contact?.email ?? '',
      is_primary: false,
    },
  });
  const bind = {
    contact_name: useFormField(form.control, 'contact_name'),
    designation: useFormField(form.control, 'designation'),
    contact_type: useFormField(form.control, 'contact_type'),
    phone: useFormField(form.control, 'phone'),
    phone_alt: useFormField(form.control, 'phone_alt'),
    email: useFormField(form.control, 'email'),
    is_primary: useFormField(form.control, 'is_primary'),
  };

  const submit = form.handleSubmit(async (values) => {
    const input = {
      contact_name: values.contact_name.trim(),
      designation: blankToNull(values.designation),
      contact_type: values.contact_type,
      phone: blankToNull(values.phone),
      phone_alt: blankToNull(values.phone_alt),
      email: blankToNull(values.email),
    };
    try {
      if (contact) {
        await update.mutateAsync(input);
        toast.success(t('contacts.saved'));
      } else {
        await create.mutateAsync({ ...input, ...(values.is_primary ? { is_primary: true } : {}) });
        toast.success(t('contacts.added', { name: input.contact_name }));
      }
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
      title={contact ? t('contacts.editTitle', { name: contact.contact_name }) : t('contacts.newTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            isPending={create.isPending || update.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('actions.save')}
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
        <Input label={t('contacts.name')} isRequired autoComplete="off" {...bind.contact_name} />
        <Input label={t('contacts.designation')} autoComplete="off" {...bind.designation} />
        <Select
          label={t('contacts.type')}
          value={bind.contact_type.value}
          options={CONTACT_TYPES.map((type) => ({ id: type, label: t(`contactType.${type}`) }))}
          onChange={(value) => {
            const type = CONTACT_TYPES.find((option) => option === value);
            if (type) bind.contact_type.onChange(type);
          }}
        />
        <Input label={t('contacts.phone')} type="tel" {...bind.phone} />
        <Input label={t('contacts.phoneAlt')} type="tel" {...bind.phone_alt} />
        <Input label={t('contacts.email')} type="email" {...bind.email} />
        {contact === null && !isFirst ? (
          <Checkbox
            className="sm:col-span-2"
            isSelected={bind.is_primary.value}
            onChange={bind.is_primary.onChange}
          >
            {t('contacts.setPrimary')}
          </Checkbox>
        ) : null}
      </form>
    </Modal>
  );
}

function ContactRow({
  owner,
  contact,
  canEdit,
  onEdit,
  onRefused,
}: {
  readonly owner: ContactOwner;
  readonly contact: Contact;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const makePrimary = useMakePrimaryContact(owner, contact);
  const remove = useDeleteContact(owner, contact);
  const [confirming, setConfirming] = useState(false);
  const lines = [contact.phone, contact.phone_alt, contact.email].filter(Boolean).join(' · ');

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{contact.contact_name}</span>
          {contact.is_primary ? <Badge tone="success" label={t('contacts.primary')} /> : null}
          {contact.contact_type === 'primary' ? null : (
            <span className="text-sm text-fg-muted">{t(`contactType.${contact.contact_type}`)}</span>
          )}
        </span>
        {contact.designation ? <span className="text-sm text-fg-muted">{contact.designation}</span> : null}
        {lines ? <span className="text-sm break-all text-fg">{lines}</span> : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {contact.is_primary ? null : (
            <Button
              variant="secondary"
              size="sm"
              isPending={makePrimary.isPending}
              onPress={() => {
                makePrimary.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('contacts.madePrimary', { name: contact.contact_name }));
                  },
                  onError: (error) => {
                    if (errorBehaviour(error) !== 'conflict') onRefused(error);
                  },
                });
              }}
            >
              {t('contacts.makePrimary')}
            </Button>
          )}
          <Button variant="ghost" size="sm" iconStart="edit" onPress={onEdit}>
            {t('contacts.edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconStart="trash"
            onPress={() => {
              setConfirming(true);
            }}
          >
            {t('contacts.delete')}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t('contacts.deleteTitle', { name: contact.contact_name })}
        consequence={t('contacts.deleteBody')}
        confirmLabel={t('contacts.delete')}
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('contacts.deleted', { name: contact.contact_name }));
          } catch (error) {
            setConfirming(false);
            onRefused(error);
          }
        }}
      />
    </li>
  );
}

/**
 * The contacts of any owner (P3 §6.2): a warehouse or a party now, buyers, brokers and suppliers later, all on the
 * same API under the owner's path. The primary contact comes first; "Make primary" switches it in one step.
 */
export function ContactsPanel({
  owner,
  canEdit,
  onRefused,
}: {
  readonly owner: ContactOwner;
  /** The owner's edit permission (warehouse.edit, land.edit, …). */
  readonly canEdit: boolean;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('org');
  const contacts = useContacts(owner);
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);

  // In the footer, not the header: on a phone the header has no room beside the title and intro.
  const add = canEdit ? (
    <Button
      variant="secondary"
      iconStart="plus"
      className="w-full sm:w-auto"
      onPress={() => {
        setEditing('new');
      }}
    >
      {t('contacts.add')}
    </Button>
  ) : undefined;

  return (
    <Card
      title={t('contacts.title')}
      description={t('contacts.intro')}
      headingLevel={2}
      {...(add ? { footer: <div className="flex sm:justify-end">{add}</div> } : {})}
    >
      {contacts.isPending ? (
        <PageLoading rows={2} />
      ) : contacts.isError ? (
        <PageError error={contacts.error} onRetry={() => void contacts.refetch()} />
      ) : contacts.data.length === 0 ? (
        <EmptyState kind="new" title={t('contacts.emptyTitle')} description={t('contacts.emptyBody')} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {contacts.data.map((contact) => (
            <ContactRow
              key={contact.id}
              owner={owner}
              contact={contact}
              canEdit={canEdit}
              onEdit={() => {
                setEditing(contact);
              }}
              onRefused={onRefused}
            />
          ))}
        </ul>
      )}
      {editing ? (
        <ContactModal
          owner={owner}
          contact={editing === 'new' ? null : editing}
          isFirst={(contacts.data ?? []).length === 0}
          onClose={() => {
            setEditing(null);
          }}
          onRefused={onRefused}
        />
      ) : null}
    </Card>
  );
}
