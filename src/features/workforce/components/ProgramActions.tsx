import { useState } from 'react';

import { usePermission } from '@/lib/auth';
import { errorBehaviour, isApiError } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Badge, type BadgeTone, Button, ConfirmDialog, Modal, Textarea, toast } from '@/ui';

import { type Program, useCancelProgram, useDeleteProgram, useProgramAction } from '../api/training';

const TONES: Record<Program['state'], BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  completed: 'info',
  cancelled: 'neutral',
};

/** Draft / Waiting for approval / Planned (approved) / Rejected / Completed / Cancelled. */
export function ProgramStateBadge({ state }: { readonly state: Program['state'] }) {
  const { t } = useTranslation('workforce');
  return <Badge tone={TONES[state]} label={t(`programStates.${state}`)} />;
}

/**
 * What can be done to a programme: delete a draft (training.delete); complete an approved one once every attendance is
 * in, or cancel a draft or approved one with a reason (training.edit).
 */
export function ProgramActions({
  program,
  onDeleted,
  onRefused,
}: {
  readonly program: Program;
  readonly onDeleted: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workforce');
  const canEdit = usePermission('training.edit');
  const canDelete = usePermission('training.delete');
  const code = program.program_code;
  const remove = useDeleteProgram();
  const complete = useProgramAction('complete', code);
  const cancel = useCancelProgram(code);
  const [asking, setAsking] = useState<'delete' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Why the programme cannot be completed yet (e.g. attendance still to record). */
  const [problem, setProblem] = useState<string | null>(null);
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
      await cancel.mutateAsync({ program, reason: reason.trim() });
      toast.success(t('training.cancelled', { code }));
      done();
    } catch (failure) {
      if (errorBehaviour(failure) === 'conflict') return;
      onRefused(failure);
      done();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {program.state === 'approved' && canEdit ? (
        <Button
          isPending={complete.isPending}
          onPress={() => {
            void complete
              .mutateAsync(program)
              .then(() => {
                toast.success(t('training.completed', { code }));
              })
              .catch((failure: unknown) => {
                if (errorBehaviour(failure) === 'conflict') return;
                if (isApiError(failure) && errorBehaviour(failure) === 'field-errors') {
                  setProblem(failure.fieldErrors[0]?.message ?? failure.message);
                  return;
                }
                onRefused(failure);
              });
          }}
        >
          {t('training.complete')}
        </Button>
      ) : null}
      {(program.state === 'draft' || program.state === 'approved') && canEdit ? (
        <Button
          variant="secondary"
          onPress={() => {
            setAsking('cancel');
          }}
        >
          {t('training.cancel')}
        </Button>
      ) : null}
      {program.state === 'draft' && canDelete ? (
        <Button
          variant="danger"
          iconStart="trash"
          onPress={() => {
            setAsking('delete');
          }}
        >
          {t('training.delete')}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={asking === 'delete'}
        onOpenChange={(open) => {
          if (!open) done();
        }}
        title={t('training.deleteTitle', { code })}
        consequence={t('training.deleteBody')}
        confirmLabel={t('training.delete')}
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(program);
            toast.success(t('training.deleted', { code }));
            onDeleted();
          } catch (failure) {
            onRefused(failure);
          }
          done();
        }}
      />
      {problem ? (
        <Modal
          isOpen
          size="sm"
          onOpenChange={() => {
            setProblem(null);
          }}
          title={t('training.cannotComplete')}
          footer={
            <Button
              onPress={() => {
                setProblem(null);
              }}
            >
              {t('training.ok')}
            </Button>
          }
        >
          <p>{problem}</p>
        </Modal>
      ) : null}
      {asking === 'cancel' ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) done();
          }}
          title={t('training.cancelTitle', { code })}
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
                {t('training.cancel')}
              </Button>
            </>
          }
        >
          <Textarea
            label={t('training.reason')}
            placeholder={t('training.placeholders.reason')}
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
