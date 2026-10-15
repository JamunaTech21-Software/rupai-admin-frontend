import { z } from 'zod';

import { api } from '@/lib/api';

const UserOption = z.looseObject({ id: z.string(), username: z.string() });

/** Users matching what was typed, for the named-approver picker (user.view). */
export async function findUsers(query: string, signal: AbortSignal) {
  const response = await api.get('/users', {
    query: { 'filter[username][like]': query, per_page: 20 },
    schema: z.array(UserOption),
    signal,
  });
  return response.data.map((user) => ({ id: user.id, label: user.username }));
}
