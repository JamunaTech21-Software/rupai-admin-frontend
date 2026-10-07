import { t } from '../i18n';

import { ApiError, ClientContractError, NetworkError, ResponseShapeError } from './errors';

/**
 * What the screen does with an error (Spec P5 Table 4.2). One mapping for the whole app, so the same failure
 * always looks the same:
 *
 * | behaviour        | when                                                        | what the screen does                                  |
 * | ---------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
 * | `field-errors`   | 422 with details naming fields                              | applyServerErrors onto the form; focus the first      |
 * | `form-alert`     | 422 business rule, 409 state, 423 closed period/lock        | Alert above the form with the message; form stays     |
 * | `conflict`       | 409 VERSION_CONFLICT                                        | conflict dialog: reload the latest and reapply        |
 * | `sign-in`        | 401 after the shared refresh failed                         | back to sign-in, keeping the page to return to        |
 * | `change-password`| 403 PASSWORD_CHANGE_REQUIRED                                | to the change-password screen                         |
 * | `forbidden`      | 403 permission or scope                                     | "You do not have access" state; no retry              |
 * | `not-found`      | 404 (also outside the user's scope, P4 §4.3)                | "Not found" state with a way back                     |
 * | `wait-retry`     | 429, 503, IDEMPOTENCY_IN_PROGRESS                           | Alert "try again in N seconds"; retry allowed         |
 * | `error-state`    | 5xx, network, unreadable response                           | ErrorState with request id and Try again              |
 * | `bug`            | the client broke its own contract (no If-Match)             | ErrorState; reported to the console in development    |
 */
export type ErrorBehaviour =
  | 'field-errors'
  | 'form-alert'
  | 'conflict'
  | 'sign-in'
  | 'change-password'
  | 'forbidden'
  | 'not-found'
  | 'wait-retry'
  | 'error-state'
  | 'bug';

export function errorBehaviour(error: unknown): ErrorBehaviour {
  if (error instanceof ClientContractError) return 'bug';
  if (error instanceof NetworkError || error instanceof ResponseShapeError) return 'error-state';
  if (!(error instanceof ApiError)) return 'error-state';
  if (error.code === 'VERSION_CONFLICT') return 'conflict';
  if (error.code === 'PASSWORD_CHANGE_REQUIRED') return 'change-password';
  // A deployment without BACKEND_URL (Vercel middleware): retrying cannot help; show its message.
  if (error.code === 'BACKEND_NOT_CONFIGURED') return 'error-state';
  if (error.code === 'IDEMPOTENCY_IN_PROGRESS' || error.status === 429 || error.status === 503)
    return 'wait-retry';
  if (error.status === 401) return 'sign-in';
  if (error.status === 403) return 'forbidden';
  if (error.status === 404) return 'not-found';
  if (error.status === 422 && error.fieldErrors.length > 0) return 'field-errors';
  if (error.status === 409 || error.status === 422 || error.status === 423 || error.status === 400) {
    return 'form-alert';
  }
  return 'error-state';
}

/** A message a person can act on, and the reference to quote. */
export function describeError(error: unknown): {
  readonly message: string;
  readonly requestId: string | null;
} {
  if (error instanceof ApiError) {
    if (error.code === 'BACKEND_NOT_CONFIGURED') return { message: error.message, requestId: null };
    if (error.status >= 500) {
      return {
        message: t('errors:serverError'),
        requestId: error.requestId,
      };
    }
    if (errorBehaviour(error) === 'wait-retry') {
      const message = error.retryAfter
        ? t('errors:busy', { seconds: error.retryAfter })
        : t('errors:busySoon');
      return { message, requestId: error.requestId };
    }
    return { message: error.message, requestId: error.requestId };
  }
  if (error instanceof ResponseShapeError) {
    return {
      message: t('errors:unexpected'),
      requestId: error.requestId,
    };
  }
  if (error instanceof Error) return { message: error.message, requestId: null };
  return { message: t('errors:generic'), requestId: null };
}
