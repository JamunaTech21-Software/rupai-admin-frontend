import { useNavigate } from 'react-router';

import { RunningJobs } from '@/features/system';
import { useAuth, useMe } from '@/lib/auth';
import { currentLanguage, setLanguage, useTranslation } from '@/lib/i18n';
import { Button, Icon, IconButton, Tooltip, UserMenu } from '@/ui';

/** Switches between English and Bangla; the button is labelled in the language it switches to. */
export function LanguageSwitch() {
  const { t } = useTranslation('common');
  const next = currentLanguage() === 'bn' ? 'en' : 'bn';
  const name = t(`languages.${next}`);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t('switchLanguage', { language: name })}
      onPress={() => {
        void setLanguage(next);
      }}
    >
      <span lang={next}>{name}</span>
    </Button>
  );
}

/**
 * The estate context (Spec P5 §3.3). Choosing among several estates arrives with estate set-up (P1.03 front
 * end); until then it shows the data scope the user has, from /auth/me.
 */
function EstateContext() {
  const { t } = useTranslation('common');
  const me = useMe();
  if (!me) return null;
  const label = me.scope.all_estates
    ? t('allEstates')
    : t('estateScoped', { count: me.scope.estates?.length ?? 0 });
  return (
    <Tooltip content={t('estateSoon')}>
      <Button variant="secondary" size="sm" aria-label={`${t('estate')}: ${label}`}>
        <Icon name="mapPin" size="sm" className="shrink-0 text-primary" />
        <span className="hidden truncate md:inline">{label}</span>
      </Button>
    </Tooltip>
  );
}

/**
 * Approvals waiting for this user. The approvals inbox endpoint is not built yet, so the count is 0 and the
 * button says so; it becomes a live count (the `live` cache policy) when the endpoint exists.
 */
function useApprovalsWaiting(): number {
  return 0;
}

function Approvals() {
  const { t } = useTranslation('common');
  const count = useApprovalsWaiting();
  return (
    <IconButton
      icon="clipboard"
      variant="ghost"
      label={count > 0 ? t('approvalsCount', { count }) : t('noApprovals')}
    />
  );
}

/** The top bar's end: estate, jobs, approvals, notifications, language and the account menu. */
export function TopBarActions() {
  const { t } = useTranslation('common');
  const auth = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  if (!me) return null;
  const roles = me.user.roles.map((role) => role.name).join(', ');

  return (
    <>
      <RunningJobs />
      <EstateContext />
      <Approvals />
      <IconButton icon="bell" variant="ghost" label={t('notifications')} />
      <LanguageSwitch />
      <UserMenu
        name={me.user.username}
        {...(roles ? { detail: roles } : {})}
        items={[
          { id: 'change-password', label: t('changePassword'), icon: 'settings' },
          { id: 'sign-out', label: t('signOut'), icon: 'logout', isDanger: true },
        ]}
        onAction={(id) => {
          if (id === 'change-password') void navigate('/change-password');
          if (id === 'sign-out') {
            void auth.signOut().finally(() => {
              void navigate('/login', { replace: true });
            });
          }
        }}
      />
    </>
  );
}
