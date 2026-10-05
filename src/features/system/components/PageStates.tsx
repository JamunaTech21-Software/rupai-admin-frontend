import { type ReactNode } from 'react';

import { useMe } from '@/lib/auth';
import { describeError, errorBehaviour } from '@/lib/errors';
import { useTranslation } from '@/lib/i18n';
import { Alert, Button, EmptyState, type EmptyKind, ErrorState, Link, Modal, Skeleton, Stack } from '@/ui';

/**
 * The five interface states as page-level patterns (Spec P5 §8). Every screen shows exactly one of them, in
 * the same way everywhere: loading, empty (with its kind), error, refused, or permission-limited.
 */

/** Loading: the page's shape in skeletons, announced once, so the layout does not jump when data arrives. */
export function PageLoading({ rows = 6 }: { readonly rows?: number }) {
  const { t } = useTranslation('common');
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        {t('loadingPage')}
      </span>
      <Skeleton variant="block" className="h-8 w-1/3" />
      <Skeleton variant="table-row" columns={4} rows={rows} />
    </div>
  );
}

export interface PageEmptyProps {
  readonly kind: EmptyKind;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

/**
 * Empty, in one of its kinds. For `scope` the description says whose data the user can see, so an empty list
 * is not mistaken for missing data.
 */
export function PageEmpty({ kind, title, description, action }: PageEmptyProps) {
  const { t } = useTranslation('states');
  const me = useMe();
  const estates = me?.scope.estates?.length ?? 0;
  const scopeText =
    description ?? t('scopeEmptyBody', { scope: t('common:estateScoped', { count: estates }) });
  return (
    <EmptyState
      kind={kind}
      size="page"
      title={title}
      {...(kind === 'scope' ? { description: scopeText } : description ? { description } : {})}
      {...(action ? { action } : {})}
    />
  );
}

/** Not allowed: the 403 state (route guard, 403 response). No retry, a way back. */
export function ForbiddenState() {
  const { t } = useTranslation('states');
  return (
    <EmptyState
      kind="no-results"
      size="page"
      title={t('forbiddenTitle')}
      description={t('forbiddenBody')}
      action={<BackHome />}
    />
  );
}

/** Not found: the 404 state (unknown address, record not found or outside the scope). */
export function NotFoundState() {
  const { t } = useTranslation('states');
  return (
    <EmptyState
      kind="no-results"
      size="page"
      title={t('notFoundTitle')}
      description={t('notFoundBody')}
      action={<BackHome />}
    />
  );
}

function BackHome() {
  const { t } = useTranslation('common');
  return (
    <Link href="/" variant="standalone">
      {t('backToHome')}
    </Link>
  );
}

export interface PageErrorProps {
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
}

/**
 * Error: the request failed. The error decides the state (lib/api errorBehaviour): 403 shows the forbidden
 * state, 404 not found, anything else the inline error with its request id and a retry.
 */
export function PageError({ error, onRetry, isRetrying }: PageErrorProps) {
  const { t } = useTranslation('states');
  const behaviour = errorBehaviour(error);
  if (behaviour === 'forbidden') return <ForbiddenState />;
  if (behaviour === 'not-found') return <NotFoundState />;
  const { message, requestId } = describeError(error);
  return (
    <ErrorState
      size="page"
      title={t('serverErrorTitle')}
      message={message}
      requestId={requestId}
      {...(onRetry ? { onRetry } : {})}
      {...(isRetrying !== undefined ? { isRetrying } : {})}
    />
  );
}

export interface RefusalDialogProps {
  /** The refused action's error (409 state, 423 closed period, 422 business rule, 403). Null closes it. */
  readonly error: unknown;
  readonly onClose: () => void;
}

/**
 * Refused: the server said no to an action the user tried (an approval on a closed period, a transition from
 * the wrong state). The dialog says why, in the server's words, with the reference; nothing is retried.
 */
export function RefusalDialog({ error, onClose }: RefusalDialogProps) {
  const { t } = useTranslation('states');
  const { message, requestId } = error ? describeError(error) : { message: '', requestId: null };
  return (
    <Modal
      isOpen={Boolean(error)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      title={t('refusedTitle')}
      footer={<Button onPress={onClose}>{t('refusedOk')}</Button>}
    >
      <Stack gap={2}>
        <p className="text-fg">{message}</p>
        {requestId ? (
          <p className="text-sm text-fg-muted">
            <code className="font-mono">{requestId}</code>
          </p>
        ) : null}
      </Stack>
    </Modal>
  );
}

/**
 * Permission-limited: the user may see this but not change it. Shown at the top of a read-only view so the
 * missing buttons are explained (Spec P5 Table 9.1).
 */
export function PermissionNotice({ action }: { readonly action?: string }) {
  const { t } = useTranslation('states');
  return (
    <Alert tone="info" announce={false}>
      {action ? t('permissionNoticeAction', { action }) : t('permissionNotice')}
    </Alert>
  );
}
