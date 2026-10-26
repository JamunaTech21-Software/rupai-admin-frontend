import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, ConfirmDialog, Modal, Textarea, toast } from '@/ui';

import { type Leave, useCancelLeave, useDeleteLeave } from '../api/leave';

const TONES: Record<Leave['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

/** Draft / Waiting for approval / Approved / Rejected / Cancelled. */
export function LeaveStateBadge({ state }: { readonly state: Leave['state'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[state]} label={t(`leaveStates.${state}`)} />;
}

/**
 * What can be done to a request (leave.create): delete a draft, cancel approved leave with a reason (the balance
 * comes back). Submitting and changing a draft are on the form.
 */
export function LeaveActions({
  leave,
  onDeleted,
  onRefused,
}: {
  readonly leave: Leave;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canUse = usePermission('leave.create');
  const remove = useDeleteLeave();
  const cancel = useCancelLeave(leave.request_number);
  const [asking, setAsking] = useState<'delete' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!canUse) return null;

  const close = () => {
    setAsking(null);
    setReason('');
    setError(null);
  };
  const submitCancel = async () => {
    if (reason.trim().length < 3) {
      setError(t('validation.reason'));
      return;
    }
    try {
      await cancel.mutateAsync({ leave, reason: reason.trim() });
      toast.success(t('leave.cancelled', { number: leave.request_number }));
      close();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      onRefused(failure);
      close();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {leave.state === 'draft' ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('leave.delete')}
        </Button>
      ) : null}
      {leave.state === 'approved' ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking('cancel');
          }}
        >
          {t('leave.cancel')}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t('leave.deleteTitle', { number: leave.request_number })}
        consequence={t('leave.deleteBody')}
        confirmLabel={t('leave.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(leave);
            toast.success(t('leave.deleted', { number: leave.request_number }));
            onDeleted();
          } catch (failure) {
            onRefused(failure);
          }
          close();
        }}
      />
      {asking === 'cancel' ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title={t('leave.cancelTitle', { number: leave.request_number })}
          footer={
            <>
              <Button variant="secondary" onPress={close}>
                {t('actions.cancel')}
              </Button>
              <Button
                isPending={cancel.isPending}
                onPress={() => {
                  void submitCancel();
                }}
              >
                {t('leave.cancel')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm text-fg-muted">{t('leave.cancelWarning')}</p>
            <Textarea
              label={t('actions.reason')}
              placeholder={t('actions.reasonPlaceholder')}
              rows={3}
              maxLength={500}
              isRequired
              value={reason}
              onChange={setReason}
              {...(error ? { error } : {})}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
