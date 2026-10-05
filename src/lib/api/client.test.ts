import { renderHook } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { server } from '../../../tests/msw/server';

import { errorBehaviour } from './behaviour';
import { createApiClient } from './client';
import { ApiError, ClientContractError, NetworkError, ResponseShapeError } from './errors';
import { useIdempotencyKey } from './idempotency';
import { getAccessToken, onSessionEnd, setAccessToken } from './session';

const BASE = 'http://api.test/api/v1';
const client = createApiClient({ baseUrl: BASE });
const url = (path: string) => `${BASE}${path}`;

const meta = { request_id: 'req_1', server_time: '2026-10-05T08:00:00Z' };
const headers = { 'X-Request-Id': 'req_1', 'X-Environment': 'test' };

function apiError(status: number, code: string, message: string, details: unknown[] = []) {
  return HttpResponse.json({ error: { code, message, details, request_id: 'req_err' } }, { status, headers });
}

beforeEach(() => {
  setAccessToken({ token: 'token-1', expiresAt: '2026-10-05T09:00:00Z' });
});
afterEach(() => {
  setAccessToken(null);
});

describe('envelopes and headers', () => {
  it('unwraps a single resource and captures request id, environment and version', async () => {
    let auth: string | null = null;
    server.use(
      http.get(url('/users/u1'), ({ request }) => {
        auth = request.headers.get('Authorization');
        return HttpResponse.json(
          { data: { id: 'u1', username: 'manager' }, meta },
          { headers: { ...headers, ETag: '"7"' } },
        );
      }),
    );
    const response = await client.get('/users/u1');
    expect(auth).toBe('Bearer token-1');
    expect(response.data).toEqual({ id: 'u1', username: 'manager' });
    expect(response.version).toBe(7);
    expect(response.requestId).toBe('req_1');
    expect(response.environment).toBe('test');
  });

  it('unwraps a page with its pagination and passes the query string through', async () => {
    let query = '';
    server.use(
      http.get(url('/users'), ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(
          {
            data: [{ id: 'u1' }],
            meta: { ...meta, pagination: { page: 2, per_page: 25, total: 26, last_page: 2 } },
            links: { first: '/users?page=1', prev: '/users?page=1', next: null, last: '/users?page=2' },
          },
          { headers },
        );
      }),
    );
    const response = await client.get('/users', { query: 'filter%5Bstatus%5D=active&sort=-username&page=2' });
    expect(decodeURIComponent(query)).toBe('?filter[status]=active&sort=-username&page=2');
    expect(response.data).toEqual([{ id: 'u1' }]);
    expect(response.meta?.pagination?.total).toBe(26);
    expect(response.links?.next).toBeNull();
  });

  it('keeps the token in memory only', async () => {
    server.use(http.get(url('/ping'), () => HttpResponse.json({ data: {}, meta }, { headers })));
    await client.get('/ping');
    const stored =
      JSON.stringify(Object.entries(window.localStorage)) +
      JSON.stringify(Object.entries(window.sessionStorage));
    expect(stored).not.toContain('token-1');
    expect(document.cookie).not.toContain('token-1');
  });
});

describe('errors', () => {
  it('turns an error body into an ApiError keyed by code', async () => {
    server.use(
      http.post(url('/users'), () =>
        apiError(422, 'VALIDATION_FAILED', 'The request is invalid.', [
          { field: 'username', code: 'DUPLICATE_KEY', message: 'Taken.' },
        ]),
      ),
    );
    const error = await client.post('/users', { username: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', requestId: 'req_err' });
    expect((error as ApiError).fieldErrors).toEqual([
      { field: 'username', code: 'DUPLICATE_KEY', message: 'Taken.' },
    ]);
    expect(errorBehaviour(error)).toBe('field-errors');
  });

  it('reads Retry-After, and survives a non-JSON gateway error', async () => {
    server.use(
      http.get(url('/busy'), () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Slow down.', details: [], request_id: 'r' } },
          { status: 429, headers: { 'Retry-After': '12' } },
        ),
      ),
      http.get(url('/gateway'), () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })),
    );
    const busy = (await client.get('/busy').catch((e: unknown) => e)) as ApiError;
    expect(busy.retryAfter).toBe(12);
    expect(errorBehaviour(busy)).toBe('wait-retry');
    const gateway = (await client.get('/gateway').catch((e: unknown) => e)) as ApiError;
    expect(gateway.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('reports a network failure, and lets an abort through untouched', async () => {
    server.use(http.get(url('/down'), () => HttpResponse.error()));
    await expect(client.get('/down')).rejects.toBeInstanceOf(NetworkError);

    server.use(
      http.get(url('/slow'), async () => {
        await delay(1000);
        return HttpResponse.json({ data: {}, meta });
      }),
    );
    const controller = new AbortController();
    const pending = client.get('/slow', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('checks the response shape outside production', async () => {
    server.use(http.get(url('/users/u1'), () => HttpResponse.json({ data: { id: 5 }, meta }, { headers })));
    const schema = z.object({ id: z.string() });
    await expect(client.get('/users/u1', { schema })).rejects.toBeInstanceOf(ResponseShapeError);
  });

  it('exposes the current version on a conflict', async () => {
    server.use(
      http.patch(url('/users/u1'), () =>
        apiError(409, 'VERSION_CONFLICT', 'Changed by someone else.', [
          { code: 'VERSION_CONFLICT', message: 'Reload.', context: { version: 9 } },
        ]),
      ),
    );
    const error = (await client.patch('/users/u1', {}, { ifMatch: 8 }).catch((e: unknown) => e)) as ApiError;
    expect(error.conflict).toEqual({ version: 9 });
    expect(errorBehaviour(error)).toBe('conflict');
  });
});

describe('If-Match and Idempotency-Key', () => {
  it('refuses a versioned mutation without If-Match before sending anything', async () => {
    const seen = vi.fn();
    server.use(
      http.all(url('/users/u1*'), () => {
        seen();
        return HttpResponse.json({ data: {}, meta });
      }),
    );
    await expect(client.patch('/users/u1', { name: 'x' })).rejects.toBeInstanceOf(ClientContractError);
    await expect(client.put('/users/u1', {})).rejects.toBeInstanceOf(ClientContractError);
    await expect(client.post('/users/u1/deactivate', undefined, { versioned: true })).rejects.toBeInstanceOf(
      ClientContractError,
    );
    expect(seen).not.toHaveBeenCalled();
    expect(errorBehaviour(new ClientContractError('x'))).toBe('bug');
  });

  it('sends If-Match as the quoted version and the Idempotency-Key', async () => {
    let ifMatch: string | null = null;
    let key: string | null = null;
    server.use(
      http.post(url('/users/u1/deactivate'), ({ request }) => {
        ifMatch = request.headers.get('If-Match');
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ data: { id: 'u1' }, meta }, { headers: { ETag: '"4"' } });
      }),
    );
    const response = await client.post('/users/u1/deactivate', undefined, {
      versioned: true,
      ifMatch: 3,
      idempotencyKey: 'key-123',
    });
    expect(ifMatch).toBe('"3"');
    expect(key).toBe('key-123');
    expect(response.version).toBe(4);
  });

  it('keeps one idempotency key across retries of an action, and a new one after success', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.key();
    expect(result.current.key()).toBe(first);
    result.current.reset();
    expect(result.current.key()).not.toBe(first);
  });
});

describe('refresh on 401', () => {
  it('ten concurrent 401s cause exactly one refresh, then every request is replayed', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(url('/auth/refresh'), async () => {
        refreshCalls += 1;
        await delay(30);
        return HttpResponse.json({
          data: { access_token: 'token-2', expires_at: '2026-10-05T10:00:00Z' },
          meta,
        });
      }),
      http.get(url('/items/:n'), ({ request, params }) => {
        if (request.headers.get('Authorization') !== 'Bearer token-2') {
          return apiError(401, 'SESSION_EXPIRED', 'Expired.');
        }
        return HttpResponse.json({ data: { n: params.n }, meta });
      }),
    );
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => client.get(`/items/${String(i)}`)),
    );
    expect(refreshCalls).toBe(1);
    expect(results.map((r) => (r.data as { n: string }).n)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
    expect(getAccessToken()).toBe('token-2');
  });

  it('ends the session when the refresh fails', async () => {
    const ended = vi.fn();
    const unsubscribe = onSessionEnd(ended);
    server.use(
      http.post(url('/auth/refresh'), () => apiError(401, 'UNAUTHENTICATED', 'No session.')),
      http.get(url('/me'), () => apiError(401, 'SESSION_EXPIRED', 'Expired.')),
    );
    const error = await client.get('/me').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(errorBehaviour(error)).toBe('sign-in');
    expect(ended).toHaveBeenCalledWith('expired');
    expect(getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('does not refresh for wrong credentials or unauthenticated calls', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(url('/auth/refresh'), () => {
        refreshCalls += 1;
        return HttpResponse.json({ data: { access_token: 'x' }, meta });
      }),
      http.post(url('/auth/login'), ({ request }) => {
        expect(request.headers.get('Authorization')).toBeNull();
        return apiError(401, 'INVALID_CREDENTIALS', 'Wrong username or password.');
      }),
    );
    const error = await client
      .post('/auth/login', { username: 'a', password: 'b' }, { auth: false })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refreshCalls).toBe(0);
  });
});

describe('errorBehaviour', () => {
  const make = (status: number, code: string) => new ApiError({ status, code, message: '' });
  it.each([
    [make(403, 'PASSWORD_CHANGE_REQUIRED'), 'change-password'],
    [make(403, 'SCOPE_DENIED'), 'forbidden'],
    [make(404, 'NOT_FOUND'), 'not-found'],
    [make(423, 'PERIOD_CLOSED'), 'form-alert'],
    [make(409, 'INVALID_TRANSITION'), 'form-alert'],
    [make(409, 'IDEMPOTENCY_IN_PROGRESS'), 'wait-retry'],
    [make(503, 'SERVICE_UNAVAILABLE'), 'wait-retry'],
    [make(500, 'INTERNAL_ERROR'), 'error-state'],
    [new NetworkError(null), 'error-state'],
  ] as const)('%o → %s', (error, behaviour) => {
    expect(errorBehaviour(error)).toBe(behaviour);
  });
});
