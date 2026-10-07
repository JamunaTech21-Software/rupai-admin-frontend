import { createContext, useContext } from 'react';
import * as z from 'zod/mini';

import { type SessionEndReason } from '../api';

/** GET /auth/me (backend auth.schema.ts MeOut): the user, their permissions and data scope. */
export const MeSchema = z.object({
  user: z.looseObject({
    id: z.string(),
    username: z.string(),
    email: z.optional(z.nullable(z.string())),
    status: z.string(),
    roles: z._default(z.array(z.looseObject({ id: z.string(), code: z.string(), name: z.string() })), []),
  }),
  permissions: z.array(z.string()),
  scope: z.looseObject({
    all_estates: z.optional(z.boolean()),
    estates: z.optional(z.array(z.unknown())),
    divisions: z.optional(z.array(z.unknown())),
    sections: z.optional(z.array(z.unknown())),
  }),
  session_id: z.nullable(z.string()),
  must_change_password: z.boolean(),
});
export type Me = z.infer<typeof MeSchema>;

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out'; readonly reason: SessionEndReason | null }
  | { readonly status: 'signed-in'; readonly me: Me };

export interface AuthContextValue {
  readonly state: AuthState;
  readonly signIn: (credentials: { username: string; password: string }) => Promise<Me>;
  readonly signOut: () => Promise<void>;
  /** Ends every session of this user (all devices), this one included. */
  readonly signOutEverywhere: () => Promise<void>;
  /** Re-reads /auth/me (after a password change, a role change). */
  readonly reload: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

/** The signed-in user, or null. */
export function useMe(): Me | null {
  const { state } = useAuth();
  return state.status === 'signed-in' ? state.me : null;
}
