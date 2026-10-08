import { useState } from 'react';

import { PageError, PageLoading } from '@/features/system';
import { errorBehaviour } from '@/lib/errors';
import { useFormat, useTranslation } from '@/lib/i18n';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Stack, toast } from '@/ui';

import { useRemoveAuthorisation, useUserAuthorisations } from '../api/access';
import { type Authorisation, type User } from '../api/schemas';
import { useUserDirectory } from '../api/users';

import { KindBadge, PermissionChips } from './SodParts';

function AuthorisationCard({
  authorisation,
  names,
  canEdit,
  onWithdraw,
}: {
  readonly authorisation: Authorisation;
  readonly names: ReadonlyMap<string, string>;
  readonly canEdit: boolean;
  readonly onWithdraw: () => void;
}) {
  const { t } = useTranslation('admin');
  const format = useFormat();
  const name = (id: string) => names.get(id) ?? t('authorisations.unknownUser', { id });
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={authorisation.kind} />
          <span className="text-sm text-fg-muted">{authorisation.rule}</span>
          <Badge
            tone={authorisation.active ? 'success' : 'neutral'}
            label={authorisation.active ? t('authorisations.active') : t('authorisations.withdrawn')}
          />
        </div>
        {canEdit && authorisation.active ? (
          <Button variant="secondary" size="sm" onPress={onWithdraw}>
            {t('authorisations.withdraw')}
          </Button>
        ) : null}
      </div>
      <PermissionChips permissions={authorisation.permissions} label={t('sod.permissionsInvolved')} />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg-muted">{t('authorisations.reason')}</span>
        <p className="text-fg">{authorisation.reason}</p>
      </div>
      <p className="text-sm text-fg-muted">
        {t('authorisations.authorisedBy', {
          name: name(authorisation.authorised_by),
          date: format.dateTime(authorisation.authorised_at),
        })}
        {authorisation.removed_at && authorisation.removed_by ? (
          <>
            <br />
            {t('authorisations.withdrawnBy', {
              name: name(authorisation.removed_by),
              date: format.dateTime(authorisation.removed_at),
            })}
          </>
        ) : null}
      </p>
    </li>
  );
}

/** User → Authorisations (P1.04): the named authorisations this user holds or held; withdraw needs user.edit. */
export function AuthorisationsTab({
  user,
  canEdit,
  onRefused,
}: {
  readonly user: User;
  readonly canEdit: boolean;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('admin');
  const list = useUserAuthorisations(user.id);
  const directory = useUserDirectory();
  const remove = useRemoveAuthorisation(user.id);
  const [withdrawing, setWithdrawing] = useState<Authorisation | null>(null);

  if (list.isPending) return <PageLoading rows={3} />;
  if (list.isError) return <PageError error={list.error} onRetry={() => void list.refetch()} />;
  // Active first, then the history, newest first within each.
  const newestFirst = (rows: Authorisation[]) =>
    [...rows].sort((a, b) => b.authorised_at.localeCompare(a.authorised_at));
  const rows = [
    ...newestFirst(list.data.filter((row) => row.active)),
    ...newestFirst(list.data.filter((row) => !row.active)),
  ];

  return (
    <Stack gap={4}>
      <p className="max-w-prose text-fg-muted">{t('authorisations.intro')}</p>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            kind="done"
            title={t('authorisations.emptyTitle')}
            description={t('authorisations.emptyBody')}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((authorisation) => (
            <AuthorisationCard
              key={authorisation.id}
              authorisation={authorisation}
              names={directory.data ?? new Map()}
              canEdit={canEdit}
              onWithdraw={() => {
                setWithdrawing(authorisation);
              }}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        isOpen={withdrawing !== null}
        onOpenChange={(open) => {
          if (!open) setWithdrawing(null);
        }}
        tone="danger"
        title={t('authorisations.withdrawTitle')}
        consequence={t('authorisations.withdrawBody')}
        confirmLabel={t('authorisations.withdraw')}
        onConfirm={async () => {
          if (!withdrawing) return;
          try {
            await remove.mutateAsync(withdrawing.id);
            toast.success(t('authorisations.withdrawnToast'));
          } catch (error) {
            setWithdrawing(null);
            if (errorBehaviour(error) === 'not-found') void list.refetch();
            else onRefused(error);
          }
        }}
      />
    </Stack>
  );
}
