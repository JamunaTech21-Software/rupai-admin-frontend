import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PageError, RefusalDialog } from '@/features/system';
import { useAuth } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DescriptionList,
  Icon,
  PageHeader,
  Skeleton,
  Stack,
  toast,
} from '@/ui';

import { type Session, useRevokeSession, useSessions } from '../api/sessions';
import { describeDevice, isMobileDevice } from '../device';

function useDeviceName() {
  const { t } = useTranslation('auth');
  return (session: Session) => {
    const { browser, system } = describeDevice(session.user_agent);
    if (browser && system) return t('account.deviceOn', { browser, system });
    return browser ?? system ?? t('account.unknownDevice');
  };
}

function SessionRow({ session, onRevoke }: { readonly session: Session; readonly onRevoke: () => void }) {
  const { t } = useTranslation('auth');
  const format = useFormat();
  const deviceName = useDeviceName();
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <Icon
          name={isMobileDevice(session.user_agent) ? 'phone' : 'monitor'}
          className="mt-0.5 shrink-0 text-fg-muted"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-fg">{deviceName(session)}</span>
            {session.current ? <Badge tone="success" label={t('account.thisDevice')} /> : null}
          </span>
          <span className="text-sm text-fg-muted">
            {/* An IPv4 address seen through an IPv6 socket arrives as ::ffff:a.b.c.d. */}
            {session.ip_address?.replace(/^::ffff:/, '') ?? t('account.unknownAddress')}
            {' · '}
            {t('account.signedInAt', { date: format.dateTime(session.created_at) })}
          </span>
          <span className="text-sm text-fg-muted">
            {t('account.lastActive', { date: format.dateTime(session.last_used_at) })}
          </span>
        </div>
      </div>
      {session.current ? null : (
        <Button
          variant="secondary"
          size="sm"
          iconStart="logout"
          className="self-start sm:self-center"
          onPress={onRevoke}
        >
          {t('account.endSession')}
        </Button>
      )}
    </li>
  );
}

function Sessions({ onRefused }: { readonly onRefused: (error: unknown) => void }) {
  const { t } = useTranslation('auth');
  const auth = useAuth();
  const navigate = useNavigate();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const deviceName = useDeviceName();
  const [ending, setEnding] = useState<Session | null>(null);
  const [everywhere, setEverywhere] = useState(false);

  const others = (sessions.data ?? []).filter((session) => !session.current).length;

  return (
    <Card
      title={t('account.sessionsTitle')}
      description={t('account.sessionsIntro')}
      headingLevel={2}
      // In the footer, not the header: on a phone the header has no room beside the title and description.
      footer={
        <div className="flex sm:justify-end">
          <Button
            variant="danger"
            iconStart="logout"
            className="w-full sm:w-auto"
            onPress={() => {
              setEverywhere(true);
            }}
          >
            {t('account.signOutEverywhere')}
          </Button>
        </div>
      }
    >
      {sessions.isPending ? (
        <Skeleton variant="text" lines={4} />
      ) : sessions.isError ? (
        <PageError error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : (
        <Stack gap={3}>
          <ul className="flex flex-col divide-y divide-line">
            {sessions.data.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={() => {
                  setEnding(session);
                }}
              />
            ))}
          </ul>
          {others === 0 ? <p className="text-sm text-fg-muted">{t('account.onlyThisDevice')}</p> : null}
        </Stack>
      )}

      <ConfirmDialog
        isOpen={ending !== null}
        onOpenChange={(open) => {
          if (!open) setEnding(null);
        }}
        tone="danger"
        title={t('account.endSessionTitle', { device: ending ? deviceName(ending) : '' })}
        consequence={t('account.endSessionBody')}
        confirmLabel={t('account.endSession')}
        onConfirm={async () => {
          if (!ending) return;
          try {
            await revoke.mutateAsync(ending.id);
            toast.success(t('account.sessionEnded'));
          } catch (error) {
            setEnding(null);
            // Already ended elsewhere (404): the list simply refreshes.
            if (errorBehaviour(error) === 'not-found') void sessions.refetch();
            else onRefused(error);
          }
        }}
      />
      <ConfirmDialog
        isOpen={everywhere}
        onOpenChange={setEverywhere}
        tone="danger"
        title={t('account.signOutEverywhereTitle')}
        consequence={t('account.signOutEverywhereBody')}
        confirmLabel={t('account.signOutEverywhere')}
        onConfirm={async () => {
          await auth.signOutEverywhere().finally(() => {
            void navigate('/login', { replace: true });
          });
        }}
      />
    </Card>
  );
}

/** Your account (P1.02): who you are signed in as, your password, and every device you are signed in on. */
export function AccountPage() {
  const { t } = useTranslation('auth');
  const { state } = useAuth();
  const [refusal, setRefusal] = useState<unknown>(null);
  if (state.status !== 'signed-in') return null;
  const { user } = state.me;

  return (
    <Stack gap={6}>
      <PageHeader title={t('account.title')} description={t('account.intro')} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card
          title={t('account.profileTitle')}
          headingLevel={2}
          className="self-start"
          actions={
            <ButtonLink href="/change-password" variant="secondary" size="sm" iconStart="shield">
              {t('changePassword')}
            </ButtonLink>
          }
        >
          <DescriptionList
            items={[
              { term: t('username'), description: user.username },
              { term: t('email'), description: user.email ?? null },
              {
                term: t('account.roles'),
                description: user.roles.length > 0 ? user.roles.map((role) => role.name).join(', ') : null,
              },
            ]}
          />
        </Card>
        <Sessions onRefused={setRefusal} />
      </div>
      <RefusalDialog
        error={refusal}
        onClose={() => {
          setRefusal(null);
        }}
      />
    </Stack>
  );
}

export { AccountPage as Component };
