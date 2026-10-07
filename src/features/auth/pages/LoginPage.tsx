import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { describeError, isApiError } from '@/lib/errors';
import { useAuth } from '@/lib/auth';
import { useFormField, useZodForm } from '@/lib/forms';
import { type TFunction, useTranslation } from '@/lib/i18n';
import { Alert, Button, Input, Link } from '@/ui';

import { AuthForm } from '../components/AuthForm';
import { safeReturnTo } from '../returnTo';

/**
 * What to tell the user when sign-in is refused. Locked, disabled and rate-limited answers get their own words
 * (with the wait in minutes or seconds); anything else uses the server's message.
 */
function signInFailure(error: unknown, t: TFunction<'auth'>): string {
  if (isApiError(error)) {
    if (error.code === 'ACCOUNT_LOCKED') {
      const detail = error.details[0];
      if (detail?.code === 'ACCOUNT_DISABLED') return t('accountDisabled');
      const seconds = detail?.context?.retry_after_seconds;
      return typeof seconds === 'number' && seconds > 0
        ? t('accountLocked', { count: Math.ceil(seconds / 60) })
        : t('accountLockedNow');
    }
    if (error.code === 'RATE_LIMITED') {
      return error.retryAfter ? t('rateLimited', { count: error.retryAfter }) : t('rateLimitedNow');
    }
  }
  return describeError(error).message;
}

/** Sign in (P1.02 /auth/login). Afterwards the user goes back to the page they asked for (?returnTo=). */
export function LoginPage() {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const [failure, setFailure] = useState<string | null>(null);

  const schema = z.object({
    username: z
      .string()
      .trim()
      .min(1, t('required', { field: t('username').toLowerCase() })),
    password: z.string().min(1, t('required', { field: t('password').toLowerCase() })),
  });
  const form = useZodForm(schema, { defaultValues: { username: '', password: '' } });
  const usernameField = useFormField(form.control, 'username');
  const passwordField = useFormField(form.control, 'password');

  if (auth.state.status === 'signed-in') return <Navigate to={returnTo} replace />;
  const reason = auth.state.status === 'signed-out' ? auth.state.reason : null;

  return (
    <AuthForm
      title={t('signInTitle')}
      intro={t('signInIntro')}
      onSubmit={() => {
        void form.handleSubmit(async (values) => {
          setFailure(null);
          try {
            await auth.signIn(values);
            void navigate(returnTo, { replace: true });
          } catch (error) {
            setFailure(signInFailure(error, t));
          }
        })();
      }}
      footer={<Link href="/forgot-password">{t('forgotLink')}</Link>}
    >
      {failure ? (
        <Alert tone="danger" title={failure} />
      ) : reason ? (
        <Alert tone="info" announce>
          {reason === 'expired' ? t('sessionExpired') : t('signedOut')}
        </Alert>
      ) : null}
      <Input label={t('username')} autoComplete="username" isRequired {...usernameField} />
      <Input
        label={t('password')}
        type="password"
        autoComplete="current-password"
        isRequired
        {...passwordField}
      />
      <Button type="submit" fullWidth isPending={form.formState.isSubmitting}>
        {t('signIn')}
      </Button>
    </AuthForm>
  );
}

export { LoginPage as Component };
