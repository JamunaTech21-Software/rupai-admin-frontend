import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy } from '@/lib/query';

const RoleOption = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });

/** Every role, for the "who is told" picker (one page of 200). */
export function useRoleChoices() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: ['notification-rule-roles'] as const,
    queryFn: async ({ signal }) =>
      (
        await api.get('/roles', {
          query: { per_page: 200, sort: 'sort_order' },
          schema: z.array(RoleOption),
          signal,
        })
      ).data,
  });
}

const UserOption = z.looseObject({ id: z.string(), username: z.string() });

/** Users matching what was typed, for the named-person picker (user.view). */
export async function findUsers(query: string, signal: AbortSignal) {
  const response = await api.get('/users', {
    query: { 'filter[username][like]': query, per_page: 20 },
    schema: z.array(UserOption),
    signal,
  });
  return response.data.map((user) => ({ id: user.id, label: user.username }));
}
