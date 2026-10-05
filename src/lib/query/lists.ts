import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { type $ZodType } from 'zod/v4/core';

import { api, type ApiClient, describeError } from '../api';
import { type TableUrlOptions, useUrlTableState } from '../urlState';

import { type CachePolicy, cachePolicy } from './cachePolicy';
import { type QueryKeys } from './keys';

interface ListOptions<TRow> extends TableUrlOptions {
  /** The resource's key factory (createQueryKeys). */
  readonly keys: QueryKeys;
  /** The list endpoint, relative to the API base: `/users`. */
  readonly path: string;
  /** One row's shape. */
  readonly row: $ZodType<TRow>;
  readonly policy?: CachePolicy;
  /** Defaults to the app's client; tests pass their own. */
  readonly client?: ApiClient;
}

function errorProps(error: Error | null, retry: () => void, isRetrying: boolean) {
  if (!error) return null;
  const { message, requestId } = describeError(error);
  return { message, requestId, onRetry: retry, isRetrying };
}

/**
 * A page-based list driven by the URL (Spec P5 §4.4): sort, filters and page come from the query string
 * (useUrlTableState), the request is exactly that query, and the previous page stays on screen while the
 * next one loads. `tableProps` spreads onto DataTable:
 *
 *   const list = usePagedList({ keys: userKeys, path: '/users', row: UserSchema, defaultSort: 'username' });
 *   <DataTable label="Users" columns={…} getRowId={(u) => u.id} {...list.tableProps} />
 */
export function usePagedList<TRow>({
  keys,
  path,
  row,
  policy = 'master',
  client = api,
  ...url
}: ListOptions<TRow>) {
  const table = useUrlTableState(url);
  const query = useQuery({
    ...cachePolicy(policy),
    queryKey: keys.list(table.apiQuery),
    queryFn: ({ signal }) => client.get(path, { query: table.apiQuery, schema: z.array(row), signal }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data ?? [];
  const total = query.data?.meta?.pagination?.total ?? 0;
  const retry = () => {
    void query.refetch();
  };

  return {
    table,
    rows,
    total,
    appliedScope: query.data?.meta?.applied_scope ?? null,
    query,
    tableProps: {
      rows,
      sort: table.sort,
      onSortChange: table.onSortChange,
      isLoading: query.isPending || (query.isPlaceholderData && query.isFetching),
      error: query.isError && rows.length === 0 ? errorProps(query.error, retry, query.isFetching) : null,
      pagination: {
        page: table.page,
        pageSize: table.pageSize,
        totalItems: total,
        onPageChange: table.onPageChange,
        onPageSizeChange: table.onPageSizeChange,
      },
    },
  };
}

/**
 * A cursor-paginated list (the very-high-growth tables): filters and sort from the URL, pages loaded on demand
 * with `cursor` + `limit`. `tableProps` spreads onto DataTable's load-more variant.
 */
export function useCursorList<TRow>({
  keys,
  path,
  row,
  policy = 'transactional',
  client = api,
  limit = 50,
  ...url
}: ListOptions<TRow> & { readonly limit?: number }) {
  const table = useUrlTableState(url);
  // The cursor replaces page and per_page.
  const base = new URLSearchParams(table.apiQuery);
  base.delete('page');
  base.delete('per_page');
  base.set('limit', String(limit));
  const baseQuery = base.toString();

  const query = useInfiniteQuery({
    ...cachePolicy(policy),
    queryKey: keys.list(baseQuery),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams(baseQuery);
      if (pageParam) params.set('cursor', pageParam);
      return client.get(path, { query: params, schema: z.array(row), signal });
    },
    getNextPageParam: (last) => last.meta?.cursor?.next_cursor ?? null,
  });
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const retry = () => {
    void query.refetch();
  };

  return {
    table,
    rows,
    query,
    tableProps: {
      rows,
      sort: table.sort,
      onSortChange: table.onSortChange,
      isLoading: query.isPending,
      error: query.isError && rows.length === 0 ? errorProps(query.error, retry, query.isFetching) : null,
      loadMore: {
        hasMore: query.hasNextPage,
        isLoadingMore: query.isFetchingNextPage,
        onLoadMore: () => {
          void query.fetchNextPage();
        },
      },
    },
  };
}
