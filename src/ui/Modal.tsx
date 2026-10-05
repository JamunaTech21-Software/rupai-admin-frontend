import { type ReactNode, useId } from 'react';
import { Dialog, DialogTrigger, Heading, Modal as AriaModal, ModalOverlay } from 'react-aria-components';

import { cx } from './cx';
import { IconButton } from './IconButton';
import { useUiText } from './uiText';

/**
 * Modal and Drawer (F0.05, Spec P5 §6.4). Both are React Aria modal dialogs: focus moves inside on open, is
 * trapped there, Escape and the close button close it, the page behind cannot scroll, and focus returns to
 * whatever opened it. Use them controlled (`isOpen` + `onOpenChange`) or inside an `OverlayTrigger` next to the
 * button that opens them.
 */

/** Opens the Modal, Drawer or ConfirmDialog inside it from the button next to it: `<OverlayTrigger><Button/>…`. */
export const OverlayTrigger = DialogTrigger;

interface OverlayBaseProps {
  /** Controlled open state. Leave out inside an OverlayTrigger. */
  readonly isOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** The heading, and the dialog's accessible name. */
  readonly title: string;
  /** One line under the title, linked as the dialog's description. */
  readonly description?: string;
  readonly children: ReactNode;
  /** Buttons along the bottom (Cancel, Save). Primary action last. */
  readonly footer?: ReactNode;
  /**
   * Whether clicking outside closes it. Off by default for anything holding unsaved input; Escape and the
   * close button always work.
   */
  readonly isDismissable?: boolean;
}

const backdrop = 'fixed inset-0 z-(--z-modal) flex bg-surface-inverse/50';

function OverlayBody({
  title,
  description,
  children,
  footer,
  className,
}: Pick<OverlayBaseProps, 'title' | 'description' | 'children' | 'footer'> & { readonly className: string }) {
  const descriptionId = useId();
  const text = useUiText();
  return (
    <Dialog
      {...(description ? { 'aria-describedby': descriptionId } : {})}
      className={cx('flex max-h-full flex-col outline-none', className)}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading slot="title" className="text-lg font-semibold text-fg">
            {title}
          </Heading>
          {description ? (
            <p id={descriptionId} className="text-sm text-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton icon="close" label={text.close} variant="ghost" size="sm" slot="close" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4">{footer}</div>
      ) : null}
    </Dialog>
  );
}

const MODAL_WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

export interface ModalProps extends OverlayBaseProps {
  readonly size?: keyof typeof MODAL_WIDTH;
}

/** A centred dialog for a short task: an edit form, a detail, a choice. Full screen below sm. */
export function Modal({ isOpen, onOpenChange, isDismissable = false, size = 'md', ...body }: ModalProps) {
  return (
    <ModalOverlay
      {...(isOpen !== undefined ? { isOpen } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
      isDismissable={isDismissable}
      className={cx(backdrop, 'items-end justify-center sm:items-center sm:p-6')}
    >
      <AriaModal
        className={cx(
          'flex max-h-dvh w-full flex-col bg-surface shadow-(--shadow-overlay) sm:max-h-[85dvh] sm:rounded-lg',
          MODAL_WIDTH[size],
        )}
      >
        <OverlayBody {...body} className="" />
      </AriaModal>
    </ModalOverlay>
  );
}

const DRAWER_WIDTH = { md: 'sm:max-w-md', lg: 'sm:max-w-2xl' } as const;

export interface DrawerProps extends OverlayBaseProps {
  readonly size?: keyof typeof DRAWER_WIDTH;
}

/**
 * A panel from the side for a longer task that keeps the page in view: filters, a record's detail, a
 * side-by-side edit. Full width below sm.
 */
export function Drawer({ isOpen, onOpenChange, isDismissable = true, size = 'md', ...body }: DrawerProps) {
  return (
    <ModalOverlay
      {...(isOpen !== undefined ? { isOpen } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
      isDismissable={isDismissable}
      className={cx(backdrop, 'justify-end')}
    >
      <AriaModal
        className={cx(
          'flex h-dvh w-full flex-col bg-surface shadow-(--shadow-overlay) sm:border-s sm:border-line',
          DRAWER_WIDTH[size],
        )}
      >
        <OverlayBody {...body} className="h-full" />
      </AriaModal>
    </ModalOverlay>
  );
}
