import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, Button, ConfirmDialog, toast } from '@/ui';

import { type Team, useDeleteTeam, useSetTeamStatus } from '../api/teams';

/** Active / Inactive. */
export function TeamStatusBadge({ status }: { readonly status: Team['status'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={status === 'active' ? 'success' : 'neutral'} label={t(`status.${status}`)} />;
}

/**
 * Deactivate / Reactivate and Delete for a team, each behind a confirmation. A team with members today cannot be
 * deactivated (end their memberships first), and one that ever had members cannot be deleted: both refusals are
 * shown by the page's RefusalDialog, with the way forward.
 */
export function TeamLifecycle({
  team,
  canEdit,
  canDelete,
  onDeleted,
  onRefused,
}: {
  readonly team: Team;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const setStatus = useSetTeamStatus(team);
  const remove = useDeleteTeam(team);
  const [asking, setAsking] = useState<'status' | 'delete' | null>(null);
  const active = team.status === 'active';
  const name = team.name;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking('status');
          }}
        >
          {t(active ? 'lifecycle.deactivate' : 'lifecycle.reactivate')}
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('lifecycle.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'status'}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={t(active ? 'lifecycle.deactivateTitle' : 'lifecycle.reactivateTitle', { name })}
        consequence={t(active ? 'team.deactivateBody' : 'lifecycle.reactivateBody')}
        confirmLabel={t(active ? 'lifecycle.deactivate' : 'lifecycle.reactivate')}
        onConfirm={async () => {
          try {
            await setStatus.mutateAsync(active ? 'deactivate' : 'reactivate');
            toast.success(t(active ? 'lifecycle.deactivated' : 'lifecycle.reactivated', { name }));
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setAsking(null);
        }}
      />
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={t('lifecycle.deleteTitle', { name })}
        consequence={t('team.deleteBody')}
        confirmLabel={t('lifecycle.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
            toast.success(t('lifecycle.deleted', { name }));
            onDeleted();
          } catch (error) {
            if (errorBehaviour(error) !== 'conflict') onRefused(error);
          }
          setAsking(null);
        }}
      />
    </div>
  );
}
