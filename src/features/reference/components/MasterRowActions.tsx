import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { ConfirmDialog, IconButton, toast } from '@/ui';

import { isProtected, type MasterRow, rowName, useDeleteMaster, useSetMasterStatus } from '../api/masters';
import { type MasterType } from '../masters';

/**
 * Edit, Deactivate / Reactivate and Delete for one reference row. Deactivating keeps the row on the records
 * that use it; Delete only works for a row nothing refers to, and the server's refusal says to deactivate.
 */
export function MasterRowActions({
  type,
  row,
  canEdit,
  canDelete,
  onEdit,
  onRefused,
}: {
  readonly type: MasterType;
  readonly row: MasterRow;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onEdit: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('ref');
  const setStatus = useSetMasterStatus(type, row);
  const remove = useDeleteMaster(type, row);
  const [dialog, setDialog] = useState<'status' | 'delete' | null>(null);
  const name = rowName(row);
  const active = row.status === 'active';
  const locked = isProtected(type, row);

  async function run(action: () => Promise<void>) {
    try {
      await action();
      setDialog(null);
    } catch (error) {
      setDialog(null);
      if (errorBehaviour(error) !== 'conflict') onRefused(error);
    }
  }

  return (
    <span className="flex items-center justify-center gap-1 whitespace-nowrap">
      {canEdit ? (
        <IconButton
          icon="edit"
          variant="ghost"
          size="sm"
          label={t('lifecycle.edit', { name })}
          onPress={onEdit}
        />
      ) : null}
      {canEdit && !(active && locked) ? (
        <IconButton
          icon={active ? 'ban' : 'refresh'}
          variant="ghost"
          size="sm"
          label={t(active ? 'lifecycle.deactivate' : 'lifecycle.reactivate', { name })}
          onPress={() => {
            setDialog('status');
          }}
        />
      ) : null}
      {canDelete && !locked ? (
        <IconButton
          icon="trash"
          variant="ghost"
          size="sm"
          label={t('lifecycle.delete', { name })}
          onPress={() => {
            setDialog('delete');
          }}
        />
      ) : null}
      <ConfirmDialog
        isOpen={dialog === 'status'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        tone={active ? 'danger' : 'primary'}
        title={t(active ? 'lifecycle.deactivateTitle' : 'lifecycle.reactivateTitle', { name })}
        consequence={t(active ? 'lifecycle.deactivateBody' : 'lifecycle.reactivateBody')}
        confirmLabel={active ? t('lifecycle.deactivateButton') : t('lifecycle.reactivateButton')}
        onConfirm={() =>
          run(async () => {
            await setStatus.mutateAsync(active ? 'deactivate' : 'reactivate');
            toast.success(t(active ? 'lifecycle.deactivated' : 'lifecycle.reactivated', { name }));
          })
        }
      />
      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        tone="danger"
        title={t('lifecycle.deleteTitle', { name })}
        consequence={t('lifecycle.deleteBody')}
        confirmLabel={t('lifecycle.deleteButton')}
        onConfirm={() =>
          run(async () => {
            await remove.mutateAsync();
            toast.success(t('lifecycle.deleted', { name }));
          })
        }
      />
    </span>
  );
}
