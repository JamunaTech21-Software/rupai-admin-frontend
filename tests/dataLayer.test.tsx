import { QueryClient, useQuery } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ConflictDialogHost, RunningJobs } from '@/features/system';
import { DataTable } from '@/ui';

import { server } from './msw/server';
import { createApiClient } from '@/lib/api/client';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { CACHE_POLICIES } from '@/lib/query/cachePolicy';
import { resolveConflict } from '@/lib/query/conflicts';
import { jobPollDelay, useJob } from '@/lib/query/jobs';
import { createQueryKeys } from '@/lib/query/keys';
import { useCursorList, usePagedList } from '@/lib/query/lists';
import { useApiMutation } from '@/lib/query/mutations';
import { QueryProvider } from '@/lib/query/QueryProvider';
import { createQueryClient, shouldRetryQuery } from '@/lib/query/queryClient';

const BASE = 'http://api.test/api/v1';
const client = createApiClient({ baseUrl: BASE });
const url = (path: string) => `${BASE}${path}`;
const meta = { request_id: 'req_1' };

afterEach(() => {
  resolveConflict();
});

function testClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(queryClient: QueryClient, path = '/') {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <QueryProvider client={queryClient}>{children}</QueryProvider>
    </MemoryRouter>
  );
}

describe('keys and policy', () => {
  it('builds nested keys so invalidation can target all, lists or one record', () => {
    const keys = createQueryKeys('users');
    expect(keys.all).toEqual(['users']);
    expect(keys.list('page=2')).toEqual(['users', 'list', 'page=2']);
    expect(keys.detail('u1')).toEqual(['users', 'detail', 'u1']);
    expect(keys.sub('u1', 'scopes')).toEqual(['users', 'detail', 'u1', 'scopes']);
  });

  it('declares a policy for each kind of data', () => {
    expect(CACHE_POLICIES.reference.staleTime).toBe(3_600_000);
    expect(CACHE_POLICIES.live).toMatchObject({ staleTime: 0, refetchInterval: 60_000 });
    expect(CACHE_POLICIES.session.staleTime).toBe(Number.POSITIVE_INFINITY);
  });

  it('retries reads only for network and server failures, and never mutations', () => {
    expect(shouldRetryQuery(0, new NetworkError(null))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError({ status: 503, code: 'SERVICE_UNAVAILABLE', message: '' }))).toBe(
      true,
    );
    expect(shouldRetryQuery(0, new ApiError({ status: 404, code: 'NOT_FOUND', message: '' }))).toBe(false);
    expect(shouldRetryQuery(2, new NetworkError(null))).toBe(false);
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});

const userKeys = createQueryKeys('users');
const User = z.object({ id: z.string(), name: z.string(), version: z.number() });

function UserEditor() {
  const detail = useQuery({
    queryKey: userKeys.detail('u1'),
    queryFn: async () => (await client.get('/users/u1', { schema: User })).data,
  });
  const save = useApiMutation({
    mutationFn: (vars: { name: string; version: number }) =>
      client.patch('/users/u1', { name: vars.name }, { ifMatch: vars.version }),
    invalidates: () => [userKeys.detail('u1'), userKeys.lists()],
    conflictSubject: () => 'User Rahim Uddin',
  });
  if (!detail.data) return <p>Loading</p>;
  return (
    <div>
      <p>
        {detail.data.name} (version {detail.data.version})
      </p>
      <button
        type="button"
        onClick={() => {
          save.mutate({ name: 'Rahim U.', version: detail.data.version });
        }}
      >
        Save
      </button>
      <ConflictDialogHost />
    </div>
  );
}

describe('mutations', () => {
  it('a stale version shows the conflict dialog, and Reload loads the current version', async () => {
    let version = 3;
    let saves = 0;
    server.use(
      http.get(url('/users/u1'), () =>
        HttpResponse.json(
          { data: { id: 'u1', name: 'Rahim Uddin', version }, meta },
          { headers: { ETag: `"${String(version)}"` } },
        ),
      ),
      http.patch(url('/users/u1'), ({ request }) => {
        saves += 1;
        if (request.headers.get('If-Match') !== `"${String(version)}"`) {
          return HttpResponse.json(
            {
              error: {
                code: 'VERSION_CONFLICT',
                message: 'The record was changed by someone else since you read it.',
                details: [{ code: 'VERSION_CONFLICT', message: 'Reload.', context: { version } }],
                request_id: 'req_c',
              },
            },
            { status: 409 },
          );
        }
        return HttpResponse.json({ data: { id: 'u1' }, meta });
      }),
    );
    const queryClient = testClient();
    render(<UserEditor />, { wrapper: wrapper(queryClient) });
    await screen.findByText('Rahim Uddin (version 3)');

    // Someone else saves meanwhile: the server is now at version 4, this screen still holds 3.
    version = 4;
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Changed by someone else' });
    expect(dialog).toHaveTextContent('User Rahim Uddin was saved by someone else');
    expect(saves).toBe(1); // not retried

    await userEvent.click(within(dialog).getByRole('button', { name: 'Reload latest version' }));
    await screen.findByText('Rahim Uddin (version 4)');
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('refreshes its invalidation set after success', async () => {
    const queryClient = testClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    server.use(
      http.post(url('/users'), () => HttpResponse.json({ data: { id: 'u9' }, meta }, { status: 201 })),
    );
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: () => client.post('/users', { name: 'x' }),
          invalidates: () => [userKeys.lists()],
        }),
      { wrapper: wrapper(queryClient) },
    );
    await act(() => result.current.mutateAsync(undefined));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users', 'list'] });
  });

  it('does not retry a failed mutation', async () => {
    let calls = 0;
    server.use(
      http.post(url('/approve'), () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'x', details: [], request_id: 'r' } },
          { status: 500 },
        );
      }),
    );
    const { result } = renderHook(
      () => useApiMutation({ mutationFn: () => client.post('/approve'), invalidates: () => [] }),
      { wrapper: wrapper(createQueryClient()) },
    );
    await act(async () => {
      await result.current.mutateAsync(undefined).catch(() => undefined);
    });
    expect(calls).toBe(1);
  });
});

const Row = z.object({ id: z.string(), name: z.string() });

function Search() {
  const location = useLocation();
  return <output aria-label="URL">{decodeURIComponent(location.search)}</output>;
}

function UsersList() {
  const list = usePagedList({
    keys: userKeys,
    path: '/users',
    row: Row,
    defaultSort: 'name',
    pageSize: 2,
    client,
  });
  return (
    <>
      <DataTable
        label="Users"
        columns={[{ id: 'name', header: 'Name', isSortable: true, cell: (u: z.infer<typeof Row>) => u.name }]}
        getRowId={(u) => u.id}
        {...list.tableProps}
      />
      <Search />
    </>
  );
}

describe('usePagedList', () => {
  it('requests exactly the URL query and pages through the URL', async () => {
    const requested: string[] = [];
    server.use(
      http.get(url('/users'), ({ request }) => {
        const query = new URL(request.url).searchParams;
        requested.push(decodeURIComponent(query.toString()));
        const page = Number.parseInt(query.get('page') ?? '1', 10);
        const all = ['Abdul', 'Mina', 'Rina'].map((name, i) => ({ id: `u${String(i)}`, name }));
        return HttpResponse.json({
          data: all.slice((page - 1) * 2, page * 2),
          meta: { ...meta, pagination: { page, per_page: 2, total: 3, last_page: 2 } },
        });
      }),
    );
    render(<UsersList />, { wrapper: wrapper(testClient(), '/users?filter[status]=active') });
    expect(await screen.findByRole('rowheader', { name: 'Abdul' })).toBeInTheDocument();
    expect(requested[0]).toBe('filter[status]=active&sort=name&page=1&per_page=2');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('rowheader', { name: 'Rina' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'URL' })).toHaveTextContent('?filter[status]=active&page=2');
    expect(requested.at(-1)).toBe('filter[status]=active&sort=name&page=2&per_page=2');
  });

  it('shows the error state with the request id when the list fails', async () => {
    server.use(
      http.get(url('/users'), () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'x', details: [], request_id: 'req_500' } },
          { status: 500 },
        ),
      ),
    );
    render(<UsersList />, { wrapper: wrapper(testClient(), '/users') });
    expect(await screen.findByText('req_500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('useCursorList', () => {
  it('loads pages with cursor and limit until there is no next cursor', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get(url('/weighings'), ({ request }) => {
        const query = new URL(request.url).searchParams;
        const cursor = query.get('cursor');
        cursors.push(cursor);
        expect(query.get('limit')).toBe('2');
        expect(query.has('page')).toBe(false);
        return HttpResponse.json({
          data: cursor
            ? [{ id: 'w3', name: 'Third' }]
            : [
                { id: 'w1', name: 'First' },
                { id: 'w2', name: 'Second' },
              ],
          meta: { ...meta, cursor: { limit: 2, next_cursor: cursor ? null : 'c2' } },
        });
      }),
    );
    const { result } = renderHook(
      () =>
        useCursorList({ keys: createQueryKeys('weighings'), path: '/weighings', row: Row, limit: 2, client }),
      { wrapper: wrapper(testClient(), '/weighings') },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });
    expect(result.current.tableProps.loadMore.hasMore).toBe(true);
    act(() => {
      result.current.tableProps.loadMore.onLoadMore();
    });
    await waitFor(() => {
      expect(result.current.rows.map((r) => r.id)).toEqual(['w1', 'w2', 'w3']);
    });
    expect(result.current.tableProps.loadMore.hasMore).toBe(false);
    expect(cursors).toEqual([null, 'c2']);
  });
});

describe('useJob', () => {
  it('backs off between polls', () => {
    expect([0, 1, 2, 3, 10].map(jobPollDelay)).toEqual([1000, 1500, 2250, 3375, 10_000]);
  });

  it('polls until the job ends, and lists it in the top bar meanwhile', async () => {
    let polls = 0;
    server.use(
      http.get(url('/jobs/j1'), () => {
        polls += 1;
        const done = polls >= 2;
        return HttpResponse.json({
          data: { id: 'j1', status: done ? 'succeeded' : 'running', progress: done ? 100 : 40 },
          meta,
        });
      }),
    );
    function Exporter() {
      const job = useJob('j1', { label: 'Exporting workers', client });
      return (
        <>
          <RunningJobs />
          <p>{job.data?.status ?? 'starting'}</p>
        </>
      );
    }
    render(<Exporter />, { wrapper: wrapper(testClient()) });
    expect(await screen.findByText('running')).toBeInTheDocument();
    expect(screen.getAllByText('Exporting workers (40%)').length).toBeGreaterThan(0);
    expect(await screen.findByText('succeeded', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/Exporting workers/)).not.toBeInTheDocument();
    expect(polls).toBe(2);
  });
});
