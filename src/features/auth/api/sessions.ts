import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation } from '@/lib/query';

/** GET /auth/sessions (backend auth.schema.ts SessionOut): the caller's sessions that can still refresh. */
export const SessionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  last_used_at: z.string(),
  expires_at: z.string(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  current: z.boolean(),
});
export type Session = z.infer<typeof SessionSchema>;

export const sessionKeys = createQueryKeys('auth-sessions');

/** Everyone has a handful of sessions at most, so one page of 100 is the whole list. */
export function useSessions() {
  return useQuery({
    ...cachePolicy('transactional'),
    queryKey: sessionKeys.list('mine'),
    queryFn: async ({ signal }) =>
      (await api.get('/auth/sessions', { query: { per_page: 100 }, schema: z.array(SessionSchema), signal }))
        .data,
  });
}

/** Ends one of the caller's other sessions (DELETE /auth/sessions/{id}). */
export function useRevokeSession() {
  return useApiMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/sessions/${id}`);
    },
    invalidates: () => [sessionKeys.lists()],
  });
}
