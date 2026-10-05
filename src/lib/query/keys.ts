/**
 * Query-key factories (Spec P5 §4.3). Every resource has one, and keys are only ever built through it, so
 * invalidation can target "all users", "every users list" or "user u1" without string typos:
 *
 *   export const userKeys = createQueryKeys('users');
 *   userKeys.all             ['users']
 *   userKeys.lists()         ['users', 'list']
 *   userKeys.list(apiQuery)  ['users', 'list', 'filter[status]=active&page=2']
 *   userKeys.detail('u1')    ['users', 'detail', 'u1']
 *   userKeys.sub('u1', 'scopes')  ['users', 'detail', 'u1', 'scopes']
 *
 * Keys are prefixes of each other, so invalidating `userKeys.all` refreshes every users query.
 */
export function createQueryKeys<const TResource extends string>(resource: TResource) {
  return {
    all: [resource] as const,
    lists: () => [resource, 'list'] as const,
    /** One list, keyed by its API query string (useUrlTableState().apiQuery). */
    list: (query: string) => [resource, 'list', query] as const,
    details: () => [resource, 'detail'] as const,
    detail: (id: string) => [resource, 'detail', id] as const,
    /** Something that belongs to one record: its scopes, its history. */
    sub: (id: string, name: string, query = '') =>
      (query ? [resource, 'detail', id, name, query] : [resource, 'detail', id, name]) as readonly string[],
  };
}

export type QueryKeys = ReturnType<typeof createQueryKeys>;
