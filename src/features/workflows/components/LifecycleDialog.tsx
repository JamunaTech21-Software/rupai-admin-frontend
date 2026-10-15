import { useState } from 'react';

import { useTranslation } from '@/lib/i18n';
import { Button, Modal, Textarea, toast } from '@/ui';

import { type Workflow, type WorkflowAction, useWorkflowAction } from '../api/workflows';

type Decision = Exclude<WorkflowAction, 'submit'>;

/**
 * The confirmation for approving, rejecting or returning a submitted workflow (P7 §15): says what will happen and
 * asks for the reason where one is needed. A reject needs a reason and a return needs what to change; an approval
 * needs a reason only when the version takes effect in the past. The server's refusal (the creator approving their
 * own version, another workflow covering the same ground) goes to `onRefused`.
 */
export function LifecycleDialog({
  workflow,
  action,
  onClose,
  onRefused,
}: {
  readonly workflow: Workflow;
  readonly action: Decision;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('workflows');
  const { mutation } = useWorkflowAction(workflow);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const needsText = action !== 'approve' || workflow.is_retrospective;

  async function submit() {
    if (needsText && text.trim() === '') {
      setError(t('lifecycle.required'));
      return;
    }
    try {
      await mutation.mutateAsync({ action, text });
      toast.success(t(`lifecycle.${action}.done`, { name: workflow.name }));
      onClose();
    } catch (failure) {
      onRefused(failure);
      onClose();
    }
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="md"
      title={t(`lifecycle.${action}.title`, { name: workflow.name })}
      description={t(`lifecycle.${action}.body`)}
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={mutation.isPending}>
            {t('lifecycle.cancel')}
          </Button>
          <Button
            variant={action === 'reject' ? 'danger' : 'primary'}
            isPending={mutation.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t(`lifecycle.${action}.confirm`)}
          </Button>
        </>
      }
    >
      <Textarea
        label={t(`lifecycle.${action}.field`)}
        value={text}
        onChange={(value) => {
          setText(value);
          setError(null);
        }}
        maxLength={500}
        rows={4}
        isRequired={needsText}
        {...(workflow.is_retrospective && action === 'approve' ? { hint: t('lifecycle.retrospective') } : {})}
        {...(error ? { error } : {})}
      />
    </Modal>
  );
}
