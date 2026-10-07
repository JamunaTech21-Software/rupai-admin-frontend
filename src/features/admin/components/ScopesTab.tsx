import { lazy, Suspense, useState } from 'react';

import { PageError, PageLoading } from '@/features/system';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Inline, Stack, toast } from '@/ui';

import { type ScopeGrant, type User } from '../api/schemas';
import { useRevokeScope, useUserScopes } from '../api/scopes';
import { useScopeLabel } from './useScopeLabel';

// The forms carry the select and date picker; opened on demand.
const ScopeGrantModal = lazy(() => import('./ScopeGrantModal').then((m) => ({ default: m.ScopeGrantModal })));
const ScopeExpiryModal = lazy(() =>
  import('./ScopeExpiryModal').then((m) => ({ default: m.ScopeExpiryModal })),
);

/** Widest first: the order of the types in the hierarchy. */
const TYPE_RANK = ['all_estates', 'estate', 'division', 'section', 'department', 'facility', 'self'];

/** Ids are digit strings: a shorter one is smaller. */
const compareIds = (a: string, b: string) => a.length - b.length || a.localeCompare(b);

/** Active grants first, then lapsed; within each, widest first, then by record number. */
function ordered(grants: readonly ScopeGrant[]): ScopeGrant[] {
  return [...grants].sort(
    (a, b) =>
      (a.active === b.active ? 0 : a.active ? -1 : 1) ||
      TYPE_RANK.indexOf(a.scope_type) - TYPE_RANK.indexOf(b.scope_type) ||
      compareIds(a.scope_id ?? '', b.scope_id ?? ''),
  );
}

function GrantRow({
  grant,
  canEdit,
  onExpiry,
  onRevoke,
}: {
  readonly grant: ScopeGrant;
  readonly canEdit: boolean;
  readonly onExpiry: () => void;
  readonly onRevoke: () => void;
}) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const label = useScopeLabel();
  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between ${grant.active ? '' : 'opacity-70'}`}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{label(grant)}</span>
          {grant.active ? null : <Badge tone="neutral" label={t('scope.lapsed')} />}
        </span>
        <span className="text-sm text-fg-muted">
          {t('user.grantedOn', { date: format.dateTime(grant.granted_at) })}
          {' · '}
          {grant.expires_at
            ? t(grant.active ? 'user.expiresOn' : 'scope.expiredOn', {
                date: format.dateTime(grant.expires_at),
              })
            : t('user.noExpiry')}
        </span>
      </span>
      {canEdit ? (
        <Inline gap={2} className="shrink-0">
          <Button variant="secondary" size="sm" iconStart="calendar" onPress={onExpiry}>
            {t('scope.changeExpiry')}
          </Button>
          <Button variant="ghost" size="sm" iconStart="trash" onPress={onRevoke}>
            {t('scope.revoke')}
          </Button>
        </Inline>
      ) : null}
    </li>
  );
}

type Dialog = { kind: 'grant' } | { kind: 'expiry' | 'revoke'; grant: ScopeGrant } | null;

/**
 * Admin → Users → one user → Scopes (P1.03): which estates, divisions, sections, departments or facilities the
 * user's data is limited to. The effective scope is the union of the active grants; self is implicit.
 */
export function ScopesTab({
  user,
  canEdit,
  onRefused,
}: {
  readonly user: User;
  readonly canEdit: boolean;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('admin');
  const label = useScopeLabel();
  const query = useUserScopes(user.id);
  const revoke = useRevokeScope(user);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => {
    setDialog(null);
  };

  if (query.isPending) return <PageLoading rows={3} />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  const grants = ordered(query.data);
  const unrestricted = grants.some((grant) => grant.active && grant.scope_type === 'all_estates');
  const activeCount = grants.filter((grant) => grant.active).length;

  return (
    <Stack gap={4}>
      <Inline justify="between" gap={3}>
        <p className="max-w-prose text-fg-muted">
          {t('scope.intro')}{' '}
          {unrestricted
            ? t('scope.summaryAll')
            : activeCount === 0
              ? t('scope.summaryNone')
              : t('scope.summaryCount', { count: activeCount })}
        </p>
        {canEdit ? (
          <Button
            variant="secondary"
            iconStart="plus"
            onPress={() => {
              setDialog({ kind: 'grant' });
            }}
          >
            {t('scope.grant')}
          </Button>
        ) : null}
      </Inline>
      {grants.length === 0 ? (
        <Card>
          <EmptyState kind="new" title={t('scope.emptyTitle')} description={t('scope.emptyBody')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t('scope.listLabel')}>
          {grants.map((grant) => (
            <GrantRow
              key={grant.id}
              grant={grant}
              canEdit={canEdit}
              onExpiry={() => {
                setDialog({ kind: 'expiry', grant });
              }}
              onRevoke={() => {
                setDialog({ kind: 'revoke', grant });
              }}
            />
          ))}
        </ul>
      )}

      <Suspense fallback={null}>
        {dialog?.kind === 'grant' ? (
          <ScopeGrantModal user={user} isOpen onClose={close} onRefused={onRefused} />
        ) : null}
        {dialog?.kind === 'expiry' ? (
          <ScopeExpiryModal user={user} grant={dialog.grant} onClose={close} onRefused={onRefused} />
        ) : null}
      </Suspense>
      <ConfirmDialog
        isOpen={dialog?.kind === 'revoke'}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        tone="danger"
        title={
          dialog?.kind === 'revoke'
            ? t('scope.revokeTitle', { scope: label(dialog.grant), username: user.username })
            : ''
        }
        consequence={t('scope.revokeBody', { username: user.username })}
        confirmLabel={t('scope.revoke')}
        onConfirm={async () => {
          if (dialog?.kind !== 'revoke') return;
          try {
            await revoke.mutateAsync(dialog.grant);
            toast.success(t('scope.revoked', { scope: label(dialog.grant) }));
            close();
          } catch (error) {
            close();
            onRefused(error);
          }
        }}
      />
    </Stack>
  );
}
