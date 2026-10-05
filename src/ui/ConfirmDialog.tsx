import { useId, useState } from 'react';
import { Dialog, Heading, Modal as AriaModal, ModalOverlay } from 'react-aria-components';

import { Button } from './Button';
import { Icon } from './Icon';
import { useUiText } from './uiText';

export interface ConfirmDialogProps {
  /** Controlled open state. Leave out inside an OverlayTrigger. */
  readonly isOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** A question naming the action and its object: "Delete gang G-04?" */
  readonly title: string;
  /**
   * Required: what will happen, in plain words, including what cannot be undone. "The 14 workers in G-04 will
   * be unassigned. This cannot be undone." A dialog that only asks "Are you sure?" is not allowed.
   */
  readonly consequence: string;
  /** Required: the action as a verb, repeated from the title: "Delete gang". Never "OK" or "Yes". */
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** `danger` for destructive or irreversible actions: red button, and Cancel gets focus first. */
  readonly tone?: 'danger' | 'primary';
  /**
   * Runs the action. While a returned promise is pending the buttons wait; if it rejects, the dialog stays open
   * and shows the error, so the user can retry or cancel.
   */
  readonly onConfirm: () => void | Promise<void>;
}

type BodyProps = Omit<ConfirmDialogProps, 'isOpen' | 'onOpenChange'> & {
  readonly close: () => void;
  readonly isPending: boolean;
  readonly setIsPending: (isPending: boolean) => void;
  /** The id the dialog points aria-describedby at. */
  readonly descriptionId: string;
};

/** The dialog's content. It mounts on each open, so an error from a previous attempt never lingers. */
function ConfirmBody({
  title,
  consequence,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  close,
  isPending,
  setIsPending,
  descriptionId,
}: BodyProps) {
  const text = useUiText();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    const result = onConfirm();
    if (!(result instanceof Promise)) {
      close();
      return;
    }
    setIsPending(true);
    result.then(
      () => {
        setIsPending(false);
        close();
      },
      (reason: unknown) => {
        setIsPending(false);
        setError(reason instanceof Error && reason.message ? reason.message : text.actionFailed);
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        {tone === 'danger' ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger">
            <Icon name="alert" />
          </span>
        ) : null}
        <div className="flex flex-col gap-2">
          <Heading slot="title" className="text-lg font-semibold text-fg">
            {title}
          </Heading>
          <p id={descriptionId} className="text-fg-muted">
            {consequence}
          </p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <Icon name="error" size="sm" className="mt-0.5" />
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onPress={close} isDisabled={isPending} autoFocus={tone === 'danger'}>
          {cancelLabel ?? text.cancel}
        </Button>
        <Button variant={tone} isPending={isPending} autoFocus={tone !== 'danger'} onPress={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Asks before an action with consequences (Spec P5 §6.4). It is an alert dialog: focus is trapped inside,
 * Escape cancels, clicking outside does nothing, and focus returns to the button that opened it.
 */
export function ConfirmDialog({ isOpen, onOpenChange, ...body }: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const descriptionId = useId();

  return (
    <ModalOverlay
      // Inside an OverlayTrigger the trigger owns the open state; only a controlled dialog takes these.
      {...(isOpen !== undefined ? { isOpen, ...(onOpenChange ? { onOpenChange } : {}) } : {})}
      isDismissable={false}
      isKeyboardDismissDisabled={isPending}
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-surface-inverse/50 p-4"
    >
      <AriaModal className="w-full max-w-md rounded-lg bg-surface shadow-(--shadow-overlay)">
        <Dialog role="alertdialog" aria-describedby={descriptionId} className="p-5 outline-none">
          {({ close }) => (
            <ConfirmBody
              {...body}
              descriptionId={descriptionId}
              close={close}
              isPending={isPending}
              setIsPending={setIsPending}
            />
          )}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
