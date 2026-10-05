import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApiClient } from '@/lib/api/client';
import { ApiError, ClientContractError } from '@/lib/api/errors';
import { signIn, signOut } from '@/lib/api/auth';
import { getAccessToken, setAccessToken } from '@/lib/api/session';
import {
  authMocks,
  expireMockTokens,
  jobMocks,
  MOCK_PASSWORD,
  mockSession,
  ok,
  page,
  queryList,
  requireAuth,
  requireIfMatch,
  startMockJob,
} from '@/lib/mocking/contract';

import { server } from './msw/server';

const BASE = 'http://api.test/api/v1';
const client = createApiClient({ baseUrl: BASE });

const WORKERS = [
  { id: 'w1', name: 'Rahim', status: 'active', joined_on: '2019-01-12' },
  { id: 'w2', name: 'Rina', status: 'disabled', joined_on: '2021-06-01' },
  { id: 'w3', name: 'Abdul', status: 'active', joined_on: '2023-03-15' },
];
let gang = { id: 'g1', name: 'G-04', version: 3 };

beforeEach(() => {
  gang = { id: 'g1', name: 'G-04', version: 3 };
  mockSession.refreshCalls = 0;
  server.use(
    ...authMocks(BASE),
    ...jobMocks(BASE),
    http.get(
      `${BASE}/workers`,
      ({ request }) => requireAuth(request) ?? page(request, queryList(WORKERS, request)),
    ),
    http.patch(`${BASE}/gangs/g1`, async ({ request }) => {
      const refused = requireAuth(request) ?? requireIfMatch(request, gang.version);
      if (refused) return refused;
      const body = (await request.json()) as { name: string };
      gang = { ...gang, name: body.name, version: gang.version + 1 };
      return ok(gang, { version: gang.version });
    }),
  );
});
afterEach(async () => {
  await signOut(client).catch(() => undefined);
  setAccessToken(null);
});

describe('auth mocks', () => {
  it('signs in with a demo account and keeps the token in memory', async () => {
    const token = await signIn({ username: 'manager', password: MOCK_PASSWORD }, client);
    expect(token.user.username).toBe('manager');
    expect(getAccessToken()).toBe(token.access_token);
    const me = await client.get<{ user: { username: string } }>('/auth/me');
    expect(me.data.user.username).toBe('manager');
  });

  it('refuses wrong credentials with INVALID_CREDENTIALS', async () => {
    await expect(signIn({ username: 'manager', password: 'nope' }, client)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('ten concurrent 401s after expiry cause exactly one refresh, and every call then succeeds', async () => {
    await signIn({ username: 'viewer', password: MOCK_PASSWORD }, client);
    expireMockTokens();
    const results = await Promise.all(Array.from({ length: 10 }, () => client.get('/auth/me')));
    expect(results).toHaveLength(10);
    expect(mockSession.refreshCalls).toBe(1);
  });
});

describe('contract helpers', () => {
  it('lists with filters, sort and pagination in the API grammar', async () => {
    await signIn({ username: 'manager', password: MOCK_PASSWORD }, client);
    const response = await client.get<{ id: string }[]>('/workers', {
      query: 'filter[status]=active&sort=-joined_on&page=1&per_page=1',
    });
    expect(response.data.map((w) => w.id)).toEqual(['w3']);
    expect(response.meta?.pagination).toEqual({ page: 1, per_page: 1, total: 2, last_page: 2 });
    expect(response.links?.next).toContain('page=2');
  });

  it('a mutation without If-Match is refused by the client; the mock refuses it too', async () => {
    await signIn({ username: 'manager', password: MOCK_PASSWORD }, client);
    await expect(client.patch('/gangs/g1', { name: 'X' })).rejects.toBeInstanceOf(ClientContractError);
    // Even a raw request that skipped the client is refused, like the backend: 422 PRECONDITION_REQUIRED.
    const raw = await fetch(`${BASE}/gangs/g1`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(raw.status).toBe(422);
    expect(((await raw.json()) as { error: { code: string } }).error.code).toBe('PRECONDITION_REQUIRED');
  });

  it('saves with the current version, and a stale version gets VERSION_CONFLICT with the current one', async () => {
    await signIn({ username: 'manager', password: MOCK_PASSWORD }, client);
    const saved = await client.patch('/gangs/g1', { name: 'G-04 North' }, { ifMatch: 3 });
    expect(saved.version).toBe(4);
    const stale = (await client
      .patch('/gangs/g1', { name: 'Old' }, { ifMatch: 3 })
      .catch((e: unknown) => e)) as ApiError;
    expect(stale).toBeInstanceOf(ApiError);
    expect(stale.code).toBe('VERSION_CONFLICT');
    expect(stale.conflict).toEqual({ version: 4 });
  });

  it('jobs advance on each poll and end with a result', async () => {
    const job = startMockJob('export', 2);
    const first = await client.get<{ status: string; progress: number }>(`/jobs/${job.id}`);
    expect(first.data).toMatchObject({ status: 'running', progress: 50 });
    const second = await client.get<{ status: string; result_url: string }>(`/jobs/${job.id}`);
    expect(second.data.status).toBe('succeeded');
    expect(second.data.result_url).toContain(job.id);
  });
});
