import { useState } from 'react';

import { useTranslation } from '@/lib/i18n';
import { Button, Modal, Textarea, toast } from '@/ui';

import { type Approval, type ApprovalKind, useApprovalAction } from '../api/approvals';

/** Reject needs a reason, return needs what to correct, a comment needs its text; an approval's note is optional. */
const NEEDS_TEXT: Record<ApprovalKind, boolean> = {
  approve: false,
  reject: true,
  return: true,
  comment: true,
};

/**
 * The confirmation for one decision on an approval (P7 §10): says what will happen, asks for the reason or comment
 * where one is required, and sends the step the user was looking at, so a step someone else decided first is
 * refused rather than decided twice. A refusal (and the reference to quote) goes to `onRefused`.
 */
export function ActionDialog({
  approval,
  kind,
  onClose,
  onRefused,
}: {
  readonly approval: Approval;
  readonly kind: ApprovalKind;
  readonly onClose: () => void;
  readonly onRefused: (error: unknown) => void;
}) {
  const { t } = useTranslation('approvals');
  const { mutation } = useApprovalAction(approval.id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const step = approval.current_step_number ?? 0;
  const label = approval.document_number ?? approval.document_label;

  async function submit() {
    if (NEEDS_TEXT[kind] && text.trim() === '') {
      setError(t('dialog.required'));
      return;
    }
    try {
      await mutation.mutateAsync({ kind, stepNumber: step, text });
      toast.success(t(`dialog.${kind}.done`, { label }));
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
      title={t(`dialog.${kind}.title`, { label })}
      description={t(`dialog.${kind}.body`, { step })}
      footer={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={mutation.isPending}>
            {t('dialog.cancel')}
          </Button>
          <Button
            variant={kind === 'reject' ? 'danger' : 'primary'}
            isPending={mutation.isPending}
            onPress={() => {
              void submit();
            }}
          >
            {t(`dialog.${kind}.confirm`)}
          </Button>
        </>
      }
    >
      <Textarea
        label={t(`dialog.${kind}.field`)}
        value={text}
        onChange={(value) => {
          setText(value);
          setError(null);
        }}
        maxLength={1000}
        rows={4}
        isRequired={NEEDS_TEXT[kind]}
        {...(error ? { error } : {})}
      />
    </Modal>
  );
}
