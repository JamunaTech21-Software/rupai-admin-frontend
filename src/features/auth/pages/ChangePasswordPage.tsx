import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { describeError, isApiError } from '@/lib/errors';
import { useAuth } from '@/lib/auth';
import { applyServerErrors, useFormField, useZodForm } from '@/lib/forms';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, Input } from '@/ui';

import { useChangePassword } from '../api/password';
import { AuthForm } from '../components/AuthForm';
import { safeReturnTo } from '../returnTo';

/**
 * Change the password. Required before anything else when the account has a temporary password
 * (`must_change_password`, 403 PASSWORD_CHANGE_REQUIRED); also reachable from the user menu.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const change = useChangePassword();
  const [failure, setFailure] = useState<string | null>(null);

  const schema = z
    .object({
      current_password: z.string().min(1, t('required', { field: t('currentPassword').toLowerCase() })),
      new_password: z.string().min(12, t('passwordRule')).max(128),
      confirm: z.string(),
    })
    .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: t('passwordsDiffer') });
  const form = useZodForm(schema, { defaultValues: { current_password: '', new_password: '', confirm: '' } });

  return (
    <AuthForm
      title={t('changeTitle')}
      intro={t('changeIntro')}
      onSubmit={() => {
        void form.handleSubmit(async (values) => {
          setFailure(null);
          try {
            await change.mutateAsync({
              current_password: values.current_password,
              new_password: values.new_password,
            });
            await auth.reload();
            void navigate(safeReturnTo(params.get('returnTo')), { replace: true });
          } catch (error) {
            if (isApiError(error) && error.fieldErrors.length > 0) {
              const unplaced = applyServerErrors(form, error.fieldErrors);
              if (unplaced.length === 0) return;
            }
            setFailure(describeError(error).message);
          }
        })();
      }}
    >
      {failure ? <Alert tone="danger" title={failure} /> : null}
      <Input
        label={t('currentPassword')}
        type="password"
        autoComplete="current-password"
        isRequired
        {...useFormField(form.control, 'current_password')}
      />
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
      <Button type="submit" fullWidth isPending={change.isPending}>
        {t('changePassword')}
      </Button>
    </AuthForm>
  );
}

export { ChangePasswordPage as Component };
