import { isRouteErrorResponse, useRouteError, useSearchParams } from 'react-router';

import { ForbiddenState, NotFoundState } from '@/features/system';
import { useTranslation } from '@/lib/i18n';
import { ErrorState } from '@/ui';

/**
 * Error routes and the per-route error boundary (Spec P5 §3.2). A render error or a failed loader shows here,
 * in place of the one route that failed: the layout, sidebar and top bar around it keep working.
 */
export function RouteError() {
  const error = useRouteError();
  const { t } = useTranslation('states');
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <NotFoundState />;
    if (error.status === 403) return <ForbiddenState />;
  }
  const requestId =
    typeof error === 'object' && error !== null && 'requestId' in error && typeof error.requestId === 'string'
      ? error.requestId
      : null;
  return (
    <ErrorState
      size="page"
      title={t('routeError')}
      message={t('serverErrorBody')}
      requestId={requestId}
      onRetry={() => {
        window.location.reload();
      }}
    />
  );
}

export function ForbiddenPage() {
  return <ForbiddenState />;
}

export function NotFoundPage() {
  return <NotFoundState />;
}

/** `/error?ref=<request id>`: where a failure that took down a whole page sends the user. */
export function ServerErrorPage() {
  const { t } = useTranslation('states');
  const [params] = useSearchParams();
  return (
    <ErrorState
      size="page"
      title={t('serverErrorTitle')}
      message={t('serverErrorBody')}
      requestId={params.get('ref')}
      onRetry={() => {
        window.history.back();
      }}
    />
  );
}
