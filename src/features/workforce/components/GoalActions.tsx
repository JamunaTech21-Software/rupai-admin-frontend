import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, ConfirmDialog, Modal, Textarea, toast } from '@/ui';

import { type Goal, isLive, useCancelGoal, useDeleteGoal, useGoalAction } from '../api/performance';

const TONES: Record<Goal['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  active: 'info',
  in_progress: 'info',
  delayed: 'warning',
  overdue: 'danger',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

/** Draft / Waiting for approval / Active / In progress / Delayed / Overdue / Completed / Rejected / Cancelled. */
export function GoalStateBadge({ state }: { readonly state: Goal['state'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[state]} label={t(`goalStates.${state}`)} />;
}

/**
 * What can be done to a goal (goal.edit / goal.delete): complete a live goal, cancel a draft or live one with a
 * reason, delete a draft. Changing and submitting a draft are on the form.
 */
export function GoalActions({
  goal,
  onDeleted,
  onRefused,
}: {
  readonly goal: Goal;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canEdit = usePermission('goal.edit');
  const canDelete = usePermission('goal.delete');
  const code = goal.goal_code;
  const complete = useGoalAction('complete', code);
  const cancel = useCancelGoal(code);
  const remove = useDeleteGoal();
  const [asking, setAsking] = useState<'delete' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setAsking(null);
    setReason('');
    setError(null);
  };
  const stop = async () => {
    if (reason.trim().length < 3) {
      setError(t('validation.reason'));
      return;
    }
    try {
      await cancel.mutateAsync({ goal, reason: reason.trim() });
      toast.success(t('goals.cancelled', { code }));
      done();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      onRefused(failure);
      done();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isLive(goal.state) && canEdit ? (
        <Button
          isPending={complete.isPending}
          onPress={() => {
            void complete
              .mutateAsync(goal)
              .then(() => {
                toast.success(t('goals.completed', { code }));
              })
              .catch((failure: unknown) => {
                if (errorBehaviour(failure) !== 'conflict') onRefused(failure);
              });
          }}
        >
          {t('goals.complete')}
        </Button>
      ) : null}
      {(goal.state === 'draft' || isLive(goal.state)) && canEdit ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking('cancel');
          }}
        >
          {t('goals.cancel')}
        </Button>
      ) : null}
      {goal.state === 'draft' && canDelete ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('goals.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) done();
        }}
        title={t('goals.deleteTitle', { code })}
        consequence={t('goals.deleteBody')}
        confirmLabel={t('goals.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(goal);
            toast.success(t('goals.deleted', { code }));
            onDeleted();
          } catch (failure) {
            onRefused(failure);
          }
          done();
        }}
      />
      {asking === 'cancel' ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) done();
          }}
          title={t('goals.cancelTitle', { code })}
          footer={
            <>
              <Button variant="secondary" onPress={done}>
                {t('actions.cancel')}
              </Button>
              <Button
                isPending={cancel.isPending}
                onPress={() => {
                  void stop();
                }}
              >
                {t('goals.cancel')}
              </Button>
            </>
          }
        >
          <Textarea
            label={t('goals.reason')}
            placeholder={t('goals.placeholders.reason')}
            rows={3}
            maxLength={500}
            isRequired
            value={reason}
            onChange={setReason}
            {...(error ? { error } : {})}
          />
        </Modal>
      ) : null}
    </div>
  );
}
