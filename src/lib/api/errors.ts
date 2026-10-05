import { t } from '../i18n';

/**
 * Typed API errors (Spec P4 §3). Every error body is `{ error: { code, message, details[], request_id } }`;
 * the client turns it into an ApiError keyed by `code`. Code branches on `code`, never on the message
 * (backend/src/core/errors/codes.ts: codes are only ever added, never renamed).
 */

/** The codes the frontend branches on. Others still arrive as strings and are handled by their status. */
export type KnownErrorCode =
  | 'MALFORMED_REQUEST'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'ACCOUNT_LOCKED'
  | 'INVALID_CREDENTIALS'
  | 'PERMISSION_DENIED'
  | 'SCOPE_DENIED'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'PRECONDITION_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INVALID_TRANSITION'
  | 'VERSION_CONFLICT'
  | 'PERIOD_CLOSED'
  | 'SEASON_CLOSED'
  | 'DOCUMENT_LOCKED';

export type ErrorCode = KnownErrorCode | (string & {});

/** One detail of the error envelope; `field` uses dot/index paths matching the request (`lines.0.quantity`). */
export interface ApiErrorDetail {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ApiErrorDetail[];
  /** The backend's request id: shown to the user ("Reference: …") and in logs. */
  readonly requestId: string | null;
  /** Seconds to wait, from Retry-After (429, 503, IDEMPOTENCY_IN_PROGRESS). */
  readonly retryAfter: number | null;

  constructor(init: {
    status: number;
    code: ErrorCode;
    message: string;
    details?: readonly ApiErrorDetail[];
    requestId?: string | null;
    retryAfter?: number | null;
  }) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfter = init.retryAfter ?? null;
  }

  /** Details that name a field: for `applyServerErrors` on a form. */
  get fieldErrors(): ApiErrorDetail[] {
    return this.details.filter((detail) => Boolean(detail.field));
  }

  /** For VERSION_CONFLICT: the current version (and representation, when the server sent it). */
  get conflict(): { readonly version: number; readonly resource?: unknown } | null {
    if (this.code !== 'VERSION_CONFLICT') return null;
    const context = this.details.find((detail) => detail.code === 'VERSION_CONFLICT')?.context;
    const version = context?.version;
    return typeof version === 'number'
      ? { version, ...(context && 'resource' in context ? { resource: context.resource } : {}) }
      : null;
  }
}

/** No response at all: offline, DNS, the tunnel down, CORS. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';
  constructor(cause: unknown) {
    super(t('errors:network'), { cause });
  }
}

/**
 * The client refused to send the request because it breaks a rule it enforces itself (Spec P4 §5.1): a
 * versioned mutation without If-Match. A programming error, caught in development before the server sees it.
 */
export class ClientContractError extends Error {
  override readonly name = 'ClientContractError';
}

/** The response did not match its schema (development and staging only). */
export class ResponseShapeError extends Error {
  override readonly name = 'ResponseShapeError';
  constructor(
    message: string,
    readonly requestId: string | null,
    readonly issues: unknown,
  ) {
    super(message);
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** Reads an error body defensively: a proxy or the tunnel can answer with HTML or nothing. */
export function toApiError(
  status: number,
  body: unknown,
  requestId: string | null,
  retryAfter: number | null,
): ApiError {
  const envelope = (
    body as {
      error?: Partial<{ code: unknown; message: unknown; details: unknown; request_id: unknown }>;
    } | null
  )?.error;
  const code = typeof envelope?.code === 'string' ? envelope.code : fallbackCode(status);
  const message =
    typeof envelope?.message === 'string' && envelope.message ? envelope.message : fallbackMessage(status);
  const details = Array.isArray(envelope?.details) ? (envelope.details as ApiErrorDetail[]) : [];
  const id =
    typeof envelope?.request_id === 'string' && envelope.request_id ? envelope.request_id : requestId;
  return new ApiError({ status, code, message, details, requestId: id, retryAfter });
}

function fallbackCode(status: number): ErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503 || status === 502 || status === 504) return 'SERVICE_UNAVAILABLE';
  return status >= 500 ? 'INTERNAL_ERROR' : 'MALFORMED_REQUEST';
}

function fallbackMessage(status: number): string {
  if (status >= 500) return 'The server could not complete the request. Try again shortly.';
  return 'The request could not be completed.';
}
