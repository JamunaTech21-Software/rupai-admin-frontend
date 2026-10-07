import { useNavigate } from 'react-router';

import { RunningJobs } from '@/features/system';
import { useAuth, useEstateContext, useMe } from '@/lib/auth';
import { currentLanguage, setLanguage, useTranslation } from '@/lib/i18n';
import { Button, ContextSwitcher, IconButton, UserMenu } from '@/ui';

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

/** The estate selector's value for everything in scope. */
const ALL = 'all';

/**
 * The estate selector (Spec P5 §3.3, §9.3), from the data scope in /auth/me. A user scoped to several estates
 * narrows the screens to one of them; all_estates is unrestricted. Estate names, and picking among every
 * estate for an unrestricted user, arrive with estate set-up (P1.07); until then estates show by number.
 */
function EstateSelector() {
  const { t } = useTranslation('common');
  const estate = useEstateContext();
  if (!estate) return null;
  const all = estate.allEstates
    ? t('allEstates')
    : estate.estates.length === 0
      ? t('noEstates')
      : t('allMyEstates');
  const options = [
    { id: ALL, label: all },
    ...(estate.allEstates ? [] : estate.estates.map((id) => ({ id, label: t('estateNumber', { id }) }))),
  ];
  // A single estate is the whole scope: show it, not a choice between it and "all".
  const shown = !estate.allEstates && estate.estates.length === 1 ? options.slice(1) : options;
  return (
    <ContextSwitcher
      label={t('estate')}
      icon="mapPin"
      options={shown}
      value={estate.selected ?? shown[0]?.id ?? ALL}
      onChange={(id) => {
        estate.select(id === ALL ? null : id);
      }}
    />
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
      <EstateSelector />
      <Approvals />
      <IconButton icon="bell" variant="ghost" label={t('notifications')} />
      <LanguageSwitch />
      <UserMenu
        name={me.user.username}
        {...(roles ? { detail: roles } : {})}
        items={[
          { id: 'account', label: t('yourAccount'), icon: 'user' },
          { id: 'change-password', label: t('changePassword'), icon: 'settings' },
          { id: 'sign-out', label: t('signOut'), icon: 'logout', isDanger: true },
        ]}
        onAction={(id) => {
          if (id === 'account') void navigate('/account');
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
