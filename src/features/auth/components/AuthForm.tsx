import { type ReactNode } from 'react';

import { useTranslation } from '@/lib/i18n';
import { Stack } from '@/ui';

export interface AuthFormProps {
  readonly title: string;
  readonly intro?: string;
  readonly onSubmit: () => void;
  readonly children: ReactNode;
  /** Links under the form ("Forgot your password?", "Back to sign in"). */
  readonly footer?: ReactNode;
}

/** The shared frame of the sign-in, forgot, reset and change-password forms: heading, intro, fields. */
export function AuthForm({ title, intro, onSubmit, children, footer }: AuthFormProps) {
  const { t } = useTranslation('common');
  return (
    <Stack gap={6}>
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/logo.png" alt="" width={56} height={56} className="size-14" />
        <p className="text-sm font-medium text-primary-strong">{t('appName')}</p>
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        {intro ? <p className="text-fg-muted">{intro}</p> : null}
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
      {footer ? <div className="flex justify-center text-sm">{footer}</div> : null}
    </Stack>
  );
}
