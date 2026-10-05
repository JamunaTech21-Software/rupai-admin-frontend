import { z } from 'zod';

import { describeError } from '@/lib/errors';
import { useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Input, Link } from '@/ui';

import { useForgotPassword } from '../api/password';
import { AuthForm } from '../components/AuthForm';

/**
 * Ask for a reset link. The answer is the same whether or not the address has an account, so this page cannot
 * be used to find out who has one.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const forgot = useForgotPassword();
  const schema = z.object({
    email: z.email(t('required', { field: t('email').toLowerCase() })),
  });
  const form = useZodForm(schema, { defaultValues: { email: '' } });

  return (
    <AuthForm
      title={t('forgotTitle')}
      intro={t('forgotIntro')}
      onSubmit={() => {
        void form.handleSubmit((values) => forgot.mutateAsync(values.email).catch(() => undefined))();
      }}
      footer={<Link href="/login">{t('backToSignIn')}</Link>}
    >
      {forgot.isSuccess ? (
        <Alert tone="success" announce>
          {t('forgotSent')}
        </Alert>
      ) : null}
      {forgot.isError ? <Alert tone="danger" title={describeError(forgot.error).message} /> : null}
      <Input
        label={t('email')}
        type="email"
        autoComplete="email"
        isRequired
        {...useFormField(form.control, 'email')}
      />
      <Button type="submit" fullWidth isPending={forgot.isPending}>
        {t('sendLink')}
      </Button>
    </AuthForm>
  );
}

export { ForgotPasswordPage as Component };
