import {
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastRegion as AriaToastRegion,
} from 'react-aria-components';

import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { toastQueue, type ToastTone } from './toastQueue';
import { useUiText } from './uiText';

const TONE: Record<ToastTone, { icon: 'checkCircle' | 'info'; className: string }> = {
  success: { icon: 'checkCircle', className: 'text-success' },
  info: { icon: 'info', className: 'text-info' },
};

/**
 * Where toasts appear: bottom end of the screen, above everything else. Rendered once by UiProvider. It is a
 * landmark region ("Notifications") reachable with F6; each toast is announced politely and has a close button.
 */
export function ToastRegion() {
  const text = useUiText();
  return (
    <AriaToastRegion
      queue={toastQueue}
      aria-label={text.notifications}
      className="fixed end-4 bottom-4 z-(--z-toast) flex w-[min(24rem,calc(100vw-2rem))] flex-col-reverse gap-2 outline-none"
    >
      {({ toast }) => (
        <AriaToast
          toast={toast}
          className={cx(
            'flex items-start gap-3 rounded-lg border border-line bg-surface p-3 shadow-(--shadow-overlay)',
            'data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus',
          )}
        >
          <Icon
            name={TONE[toast.content.tone].icon}
            className={cx('mt-0.5 shrink-0', TONE[toast.content.tone].className)}
          />
          <AriaToastContent className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Text slot="title" className="font-medium text-fg">
              {toast.content.title}
            </Text>
            {toast.content.description ? (
              <Text slot="description" className="text-sm text-fg-muted">
                {toast.content.description}
              </Text>
            ) : null}
          </AriaToastContent>
          <IconButton icon="close" label={text.closeNotification} variant="ghost" size="sm" slot="close" />
        </AriaToast>
      )}
    </AriaToastRegion>
  );
}
