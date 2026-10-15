import { useNavigate } from 'react-router';

import { useApprovalsWaiting } from '@/features/approvals';
import { RunningJobs } from '@/features/jobs';
import { useAuth, useEstateContext, useMe } from '@/lib/auth';
import { todayIn } from '@/lib/dates';
import { currentLanguage, setLanguage, useFormat, useTranslation } from '@/lib/i18n';
import { Button, ContextSwitcher, Icon, IconButton, UserMenu } from '@/ui';

/** Switches between English and Bangla; the button is labelled in the language it switches to. */
/** Today's business date, in a pill on wide screens (design R.1). */
function Today() {
  const format = useFormat();
  return (
    <span className="hidden items-center gap-2 rounded-md border border-line bg-canvas px-3 py-1.5 text-sm text-fg-muted xl:flex">
      <Icon name="calendar" size="sm" className="text-primary" />
      <span>{format.date(todayIn())}</span>
    </span>
  );
}

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

/** The approval queue, with how many approvals await this user (a live count, refreshed every minute). */
function Approvals() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const count = useApprovalsWaiting().data ?? 0;
  return (
    <IconButton
      icon="clipboard"
      variant="ghost"
      label={count > 0 ? t('approvalsCount', { count }) : t('noApprovals')}
      onPress={() => {
        void navigate('/approvals');
      }}
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
      <Today />
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
