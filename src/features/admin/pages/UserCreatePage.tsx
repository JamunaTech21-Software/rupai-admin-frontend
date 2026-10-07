import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { RefusalDialog } from '@/features/system';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Button, ButtonLink, Card, Input, PageHeader, Stack, toast } from '@/ui';

import { useCreateUser } from '../api/users';

/** Admin → Users → Add user. The new user has no roles; the next step is giving them one. */
export function UserCreatePage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const create = useCreateUser();
  const [refusal, setRefusal] = useState<unknown>(null);

  const schema = z
    .object({
      username: z
        .string()
        .trim()
        .min(3, t('validation.usernameLength'))
        .max(50, t('validation.usernameLength')),
      email: z.union([z.literal(''), z.email(t('validation.email'))]),
      phone: z.string().trim().max(30),
      initial_password: z
        .string()
        .min(12, t('validation.passwordLength'))
        .max(128, t('validation.passwordLength')),
      confirm: z.string(),
    })
    .refine((v) => v.initial_password === v.confirm, {
      path: ['confirm'],
      message: t('validation.passwordsDiffer'),
    });
  const form = useZodForm(schema, {
    defaultValues: { username: '', email: '', phone: '', initial_password: '', confirm: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const user = await create.mutateAsync({
        username: values.username,
        email: values.email === '' ? null : values.email,
        phone: values.phone === '' ? null : values.phone,
        initial_password: values.initial_password,
      });
      toast.success(t('user.created', { username: user.username }), t('user.createdHint'));
      void navigate(`/admin/users/${user.id}?tab=roles`);
    } catch (error) {
      if (errorBehaviour(error) === 'field-errors' && isApiError(error)) {
        const rest = applyServerErrors(form, error.fieldErrors);
        if (rest.length === 0) return;
      }
      setRefusal(error);
    }
  });

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('user.newTitle')}
        description={t('user.newIntro')}
        breadcrumbs={[{ label: t('user.backToList'), href: '/admin/users' }, { label: t('user.newTitle') }]}
      />
      <Card className="w-full max-w-2xl">
        <form
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <Input
            label={t('user.username')}
            hint={t('user.usernameHint')}
            autoComplete="off"
            isRequired
            className="sm:col-span-2"
            {...useFormField(form.control, 'username')}
          />
          <Input
            label={t('user.email')}
            hint={t('user.emailHint')}
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
          <Input
            label={t('user.initialPassword')}
            hint={t('user.initialPasswordHint')}
            type="password"
            autoComplete="new-password"
            isRequired
            {...useFormField(form.control, 'initial_password')}
          />
          <Input
            label={t('user.confirmPassword')}
            type="password"
            autoComplete="new-password"
            isRequired
            {...useFormField(form.control, 'confirm')}
          />
          <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
            <ButtonLink href="/admin/users" variant="secondary">
              {t('user.backToList')}
            </ButtonLink>
            <Button type="submit" isPending={create.isPending}>
              {t('user.create')}
            </Button>
          </div>
        </form>
      </Card>
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { UserCreatePage as Component };
