import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { describeError, isApiError } from '@/lib/errors';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Input, Link, toast } from '@/ui';

import { useResetPassword } from '../api/password';
import { AuthForm } from '../components/AuthForm';

/**
 * Set a new password from the emailed link. The token comes in the URL fragment (`/reset-password#token=…`), so it
 * is never sent to a server or kept in logs; it is read once and removed from the address bar. An older
 * `?token=` link still works.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(
    () => new URLSearchParams(location.hash.replace(/^#/, '')).get('token') ?? params.get('token') ?? '',
  );
  useEffect(() => {
    if (location.hash !== '' || params.has('token'))
      void navigate({ hash: '', search: '' }, { replace: true });
  }, [location.hash, params, navigate]);
  const reset = useResetPassword();
  const [failure, setFailure] = useState<string | null>(null);

  const schema = z
    .object({
      new_password: z.string().min(12, t('passwordRule')).max(128),
      confirm: z.string(),
    })
    .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: t('passwordsDiffer') });
  const form = useZodForm(schema, { defaultValues: { new_password: '', confirm: '' } });

  return (
    <AuthForm
      title={t('resetTitle')}
      intro={t('resetIntro')}
      onSubmit={() => {
        void form.handleSubmit(async (values) => {
          setFailure(null);
          try {
            await reset.mutateAsync({ token, new_password: values.new_password });
            toast.success(t('resetDone'));
            void navigate('/login', { replace: true });
          } catch (error) {
            if (isApiError(error) && error.fieldErrors.length > 0) {
              const unplaced = applyServerErrors(form, error.fieldErrors);
              if (unplaced.length === 0) return;
            }
            setFailure(describeError(error).message);
          }
        })();
      }}
      footer={<Link href="/login">{t('backToSignIn')}</Link>}
    >
      {token === '' ? <Alert tone="warning" title={t('resetMissingToken')} /> : null}
      {failure ? <Alert tone="danger" title={failure} /> : null}
      <Input
        label={t('newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('passwordRule')}
        isRequired
        {...useFormField(form.control, 'new_password')}
      />
      <Input
        label={t('confirmPassword')}
        type="password"
        autoComplete="new-password"
        isRequired
        {...useFormField(form.control, 'confirm')}
      />
      <Button type="submit" fullWidth isPending={reset.isPending} isDisabled={token === ''}>
        {t('setPassword')}
      </Button>
    </AuthForm>
  );
}

export { ResetPasswordPage as Component };
