import { useState } from 'react';

import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, Button, ConfirmDialog, toast } from '@/ui';

import { type NodePath, useDeleteNode, useSetNodeStatus } from '../api/hierarchy';
import { type NodeStatus } from '../api/schemas';

/** Active / Inactive. */
export function NodeStatusBadge({ status }: { readonly status: NodeStatus }) {
  const { t } = useTranslation('org');
  return <Badge tone={status === 'active' ? 'success' : 'neutral'} label={t(`status.${status}`)} />;
}

/** The confirm-dialog texts of one kind of node (estate, structure node, field). */
export interface LifecycleText {
  readonly deactivateTitle: string;
  readonly deactivateBody: string;
  readonly reactivateTitle: string;
  readonly reactivateBody: string;
  readonly deleteTitle: string;
  readonly deleteBody: string;
  readonly deactivated: string;
  readonly reactivated: string;
  readonly deleted: string;
}

export interface NodeLifecycleProps {
  readonly path: NodePath;
  readonly node: { readonly id: string; readonly version: number; readonly status: NodeStatus };
  /** For the conflict dialog: "Rupai Hills Tea Estate". */
  readonly subject: string;
  readonly text: LifecycleText;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly size?: 'sm' | 'md';
  readonly onDeleted?: () => void;
  /** A refusal to show in the page's RefusalDialog (e.g. REFERENCED_RECORD: deactivate instead). */
  readonly onRefused: (error: unknown) => void;
}

/**
 * Deactivate / Reactivate and Delete for any node of the hierarchy, each behind a confirmation. Deactivation
 * keeps the record (and its history); delete only works for a node nothing refers to, and the server's
 * REFERENCED_RECORD refusal says to deactivate instead.
 */
export function NodeLifecycle({
  path,
  node,
  subject,
  text,
  canEdit,
  canDelete,
  size = 'md',
  onDeleted,
  onRefused,
}: NodeLifecycleProps) {
  const { t } = useTranslation('org');
  const setStatus = useSetNodeStatus(path, node, subject);
  const remove = useDeleteNode(path, node);
  const [dialog, setDialog] = useState<'status' | 'delete' | null>(null);
  const active = node.status === 'active';

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setDialog(null);
      if (errorBehaviour(error) !== 'conflict') onRefused(error);
    }
  }

  if (!canEdit && !canDelete) return null;
  return (
    <>
      {canEdit ? (
        <Button
          variant="secondary"
          size={size}
          onPress={() => {
            setDialog('status');
          }}
        >
          {active ? t('actions.deactivate') : t('actions.reactivate')}
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant={size === 'sm' ? 'ghost' : 'danger'}
          size={size}
          iconStart="trash"
          onPress={() => {
            setDialog('delete');
          }}
        >
          {t('actions.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={dialog === 'status'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        tone={active ? 'danger' : 'primary'}
        title={active ? text.deactivateTitle : text.reactivateTitle}
        consequence={active ? text.deactivateBody : text.reactivateBody}
        confirmLabel={active ? t('actions.deactivate') : t('actions.reactivate')}
        onConfirm={() =>
          run(async () => {
            await setStatus.mutateAsync(active ? 'deactivate' : 'reactivate');
            toast.success(active ? text.deactivated : text.reactivated);
          })
        }
      />
      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        tone="danger"
        title={text.deleteTitle}
        consequence={text.deleteBody}
        confirmLabel={t('actions.delete')}
        onConfirm={() =>
          run(async () => {
            await remove.mutateAsync();
            toast.success(text.deleted);
            onDeleted?.();
          })
        }
      />
    </>
  );
}
