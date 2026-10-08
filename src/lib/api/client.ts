import { config } from '../env';

import { ClientContractError, NetworkError, ResponseShapeError, toApiError, type ApiError } from './errors';
import {
  endSession,
  getAccessToken,
  recordEnvironment,
  requirePasswordChange,
  setAccessToken,
} from './session';

/**
 * The one API client (Spec P5 §3.4, P4 §2–§5). Features call it from their api/ hooks; pages never do.
 *
 * - attaches `Authorization: Bearer <token>` from memory (session.ts)
 * - unwraps the two envelopes: `{ data, meta }` and `{ data: [], meta: { pagination | cursor }, links }`
 * - turns error bodies into ApiError keyed by `error.code`
 * - captures X-Request-Id, X-Environment and ETag (as `version`)
 * - passes the caller's AbortSignal through
 * - checks `data` against a Zod schema outside production (the API sends X-Environment everywhere but
 *   production), so a contract drift fails loudly in development and staging
 * - on 401 runs ONE shared refresh for all waiting requests, then replays each of them once
 * - refuses a versioned mutation without If-Match before it leaves the browser (P4 §5.1)
 * - never retries a mutation by itself
 */

/**
 * Anything with Zod's safeParse: a full `zod` schema (forms, features) or a `zod/mini` one (the start-up
 * schemas, kept small so the first page load stays light).
 */
export interface ResponseSchema<TData> {
  safeParse(
    data: unknown,
  ):
    | { readonly success: true; readonly data: TData }
    | { readonly success: false; readonly error: { readonly issues: unknown } };
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions<TData> {
  readonly method?: Method;
  /** Query string: an `apiQuery` string from useUrlTableState, URLSearchParams, or a plain object. */
  readonly query?: string | URLSearchParams | Readonly<Record<string, QueryValue>>;
  readonly body?: unknown;
  /** The shape of `data`. Checked outside production. */
  readonly schema?: ResponseSchema<TData>;
  readonly signal?: AbortSignal;
  /** The version the user read (from `version` / ETag). Sent as `If-Match: "<version>"`. */
  readonly ifMatch?: number;
  /**
   * The resource is versioned, so If-Match is mandatory. True by default for PUT and PATCH; set it on a
   * versioned POST transition (approve, deactivate). The client refuses to send without `ifMatch`.
   */
  readonly versioned?: boolean;
  /** Sent as Idempotency-Key: the same key for every retry of one user action (useIdempotencyKey). */
  readonly idempotencyKey?: string;
  /** Send the bearer token and refresh on 401. Off for sign-in, forgot and reset password. */
  readonly auth?: boolean;
}

export interface PagePagination {
  readonly page: number;
  readonly per_page: number;
  readonly total: number;
  readonly last_page: number;
}

export interface ApiMeta {
  readonly request_id: string;
  readonly server_time?: string;
  readonly pagination?: PagePagination;
  readonly cursor?: { readonly limit: number; readonly next_cursor: string | null };
  readonly applied_scope?: Readonly<Record<string, unknown>>;
}

export interface ApiResponse<TData> {
  readonly status: number;
  readonly data: TData;
  readonly meta: ApiMeta | null;
  readonly links: Readonly<Record<string, string | null>> | null;
  /** From the ETag header (`"3"` → 3), for the next If-Match. */
  readonly version: number | null;
  readonly requestId: string | null;
  readonly environment: string | null;
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  /** Injectable for tests. */
  readonly fetch?: typeof fetch;
}

const ETAG = /^(?:W\/)?"?(\d{1,15})"?$/;

function toQueryString(query: RequestOptions<unknown>['query']): string {
  if (query === undefined) return '';
  if (typeof query === 'string') return query.replace(/^\?/, '');
  if (query instanceof URLSearchParams) return query.toString();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Refresh is only worth trying when the token expired, not when the credentials are wrong. */
const REFRESHABLE = new Set(['UNAUTHENTICATED', 'SESSION_EXPIRED']);

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, '');
  const doFetch = (input: string, init: RequestInit) => (options.fetch ?? globalThis.fetch)(input, init);

  /** The refresh in progress, shared by every request that hit a 401 meanwhile. */
  let refreshing: Promise<boolean> | null = null;

  async function runRefresh(): Promise<boolean> {
    let response: Response;
    try {
      response = await doFetch(`${base}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
    } catch {
      return false;
    }
    if (!response.ok) return false;
    const body = (await readJson(response)) as {
      data?: { access_token?: unknown; expires_at?: unknown };
    } | null;
    const token = body?.data?.access_token;
    if (typeof token !== 'string') return false;
    setAccessToken({
      token,
      expiresAt: typeof body?.data?.expires_at === 'string' ? body.data.expires_at : '',
    });
    return true;
  }

  /**
   * One refresh at a time (the backend also rotates the cookie single-flight). Every caller waiting on a 401
   * shares the same promise, so ten concurrent 401s cause exactly one POST /auth/refresh.
   */
  function refreshOnce(): Promise<boolean> {
    refreshing ??= runRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    try {
      return await doFetch(`${base}${path}`, { ...init, headers });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (init.signal?.aborted) throw init.signal.reason;
      throw new NetworkError(error);
    }
  }

  async function request<TData>(path: string, opts: RequestOptions<TData> = {}): Promise<ApiResponse<TData>> {
    const method = opts.method ?? 'GET';
    const versioned = opts.versioned ?? (method === 'PUT' || method === 'PATCH');
    if (versioned && opts.ifMatch === undefined) {
      throw new ClientContractError(
        `${method} ${path} changes a versioned record and must send If-Match with the version that was read.`,
      );
    }

    const query = toQueryString(opts.query);
    const url = query ? `${path}?${query}` : path;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.ifMatch !== undefined) headers['If-Match'] = `"${String(opts.ifMatch)}"`;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    const init: RequestInit = {
      method,
      headers,
      credentials: 'same-origin',
      // TanStack Query is the cache. The browser's HTTP cache must not answer API reads: the API's ETag is the
      // record version, which a derived field (e.g. warehouse.phone, from the primary contact) changes without
      // bumping, so a revalidated 304 would show stale data.
      cache: 'no-store',
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    };

    const useAuth = opts.auth !== false;
    const tokenUsed = useAuth ? getAccessToken() : null;
    let response = await send(url, init, tokenUsed);

    if (response.status === 401 && useAuth) {
      const first = toApiError(401, await readJson(response), response.headers.get('X-Request-Id'), null);
      if (!REFRESHABLE.has(first.code)) throw first;
      // Another request may already have refreshed while this one was in flight: then just replay.
      const alreadyRefreshed = getAccessToken() !== null && getAccessToken() !== tokenUsed;
      const refreshed = alreadyRefreshed || (await refreshOnce());
      if (!refreshed) {
        endSession('expired');
        throw first;
      }
      response = await send(url, init, getAccessToken());
      if (response.status === 401) {
        const second = toApiError(401, await readJson(response), response.headers.get('X-Request-Id'), null);
        endSession('expired');
        throw second;
      }
    }

    const requestId = response.headers.get('X-Request-Id');
    const environment = response.headers.get('X-Environment');
    recordEnvironment(environment);
    const body = await readJson(response);

    if (!response.ok) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
      const error = toApiError(
        response.status,
        body,
        requestId,
        Number.isNaN(retryAfter) ? null : retryAfter,
      );
      if (error.code === 'PASSWORD_CHANGE_REQUIRED') requirePasswordChange();
      throw error;
    }

    const envelope = (body ?? {}) as {
      data?: unknown;
      meta?: ApiMeta;
      links?: Record<string, string | null>;
    };
    let data = (response.status === 204 ? null : envelope.data) as TData;
    // Production omits X-Environment; development, test and staging send it, and there the shape is checked.
    if (opts.schema && (environment !== null || import.meta.env.DEV)) {
      const parsed = opts.schema.safeParse(data);
      if (!parsed.success) {
        throw new ResponseShapeError(
          `${method} ${path}: the response does not match the expected shape.`,
          requestId,
          parsed.error.issues,
        );
      }
      data = parsed.data;
    }
    const etag = ETAG.exec(response.headers.get('ETag') ?? '');
    return {
      status: response.status,
      data,
      meta: envelope.meta ?? null,
      links: envelope.links ?? null,
      version: etag?.[1] ? Number.parseInt(etag[1], 10) : null,
      requestId,
      environment,
    };
  }

  return {
    request,
    get: <T>(path: string, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) =>
      request<T>(path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) =>
      request<T>(path, { ...opts, method: 'POST', ...(body !== undefined ? { body } : {}) }),
    put: <T>(path: string, body: unknown, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) =>
      request<T>(path, { ...opts, method: 'PUT', body }),
    patch: <T>(path: string, body: unknown, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) =>
      request<T>(path, { ...opts, method: 'PATCH', body }),
    delete: <T = null>(path: string, opts: Omit<RequestOptions<T>, 'method' | 'body'> = {}) =>
      request<T>(path, { ...opts, method: 'DELETE' }),
    /** For tests: the refresh currently in flight, if any. */
    refreshOnce,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app's client. Same origin by default (`/api/v1`), so the refresh cookie stays first-party. */
export const api: ApiClient = createApiClient({ baseUrl: config.apiBaseUrl });

export type { ApiError };
