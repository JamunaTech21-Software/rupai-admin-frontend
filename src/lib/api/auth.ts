import * as z from 'zod/mini';

import { api, type ApiClient } from './client';
import { endSession, setAccessToken } from './session';

/** POST /auth/login and /auth/refresh answer with this (backend auth.schema.ts TokenOut). */
export const TokenSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number(),
  expires_at: z.string(),
  session_id: z.string(),
  must_change_password: z.boolean(),
  user: z.object({ id: z.string(), username: z.string() }),
});
export type TokenResponse = z.infer<typeof TokenSchema>;

/** Signs in: the refresh cookie is set by the server, the access token is kept in memory. */
export async function signIn(
  credentials: { readonly username: string; readonly password: string },
  client: ApiClient = api,
): Promise<TokenResponse> {
  const { data } = await client.post('/auth/login', credentials, { schema: TokenSchema, auth: false });
  setAccessToken({ token: data.access_token, expiresAt: data.expires_at });
  return data;
}

/** Signs out this session. The server clears the cookie; the token is forgotten even if the call fails. */
export async function signOut(client: ApiClient = api): Promise<void> {
  try {
    await client.post('/auth/logout');
  } finally {
    endSession('signed-out');
  }
}
