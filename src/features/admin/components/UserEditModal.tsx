import { z } from 'zod';

import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, Input, Modal, toast } from '@/ui';

import { type User } from '../api/schemas';
import { useUpdateUser } from '../api/users';

export interface UserEditModalProps {
  readonly user: User;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** A refusal the form cannot place on a field (shown by the page's RefusalDialog). */
  readonly onRefused: (error: unknown) => void;
}

/** Edit username, email and phone. Saved with If-Match; a stale version opens the conflict dialog. */
export function UserEditModal({ user, isOpen, onClose, onRefused }: UserEditModalProps) {
  const { t } = useTranslation('admin');
  const update = useUpdateUser(user);
  const schema = z.object({
    username: z
      .string()
      .trim()
      .min(3, t('validation.usernameLength'))
      .max(50, t('validation.usernameLength')),
    email: z.union([z.literal(''), z.email(t('validation.email'))]),
    phone: z.string().trim().max(30),
  });
  const form = useZodForm(schema, {
    values: { username: user.username, email: user.email ?? '', phone: user.phone ?? '' },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        username: values.username,
        email: values.email === '' ? null : values.email,
        phone: values.phone === '' ? null : values.phone,
      });
      toast.success(t('user.saved'));
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
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('user.editTitle', { username: user.username })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('ui:cancel')}
          </Button>
          <Button
            isPending={update.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t('user.save')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Input
          label={t('user.username')}
          isRequired
          autoComplete="off"
          {...useFormField(form.control, 'username')}
        />
        <Input
          label={t('user.email')}
          type="email"
          autoComplete="off"
          {...useFormField(form.control, 'email')}
        />
        <Input
          label={t('user.phone')}
          type="tel"
          autoComplete="off"
          {...useFormField(form.control, 'phone')}
        />
      </form>
    </Modal>
  );
}
