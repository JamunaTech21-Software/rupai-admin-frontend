import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
  api,
  type ApiClient,
  onPasswordChangeRequired,
  onSessionEnd,
  setAccessToken,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signOutEverywhere as apiSignOutEverywhere,
} from '../api';

import { AuthContext, type AuthContextValue, type AuthState, MeSchema } from './me';

export interface AuthProviderProps {
  readonly children: ReactNode;
  readonly client?: ApiClient;
  /**
   * Reference data every screen needs, loaded once after sign-in and before the app renders (Spec P5 §3.5).
   * Nothing is needed yet; modules add theirs here.
   */
  readonly loadLookups?: (client: ApiClient) => Promise<void>;
}

/**
 * The session (Spec P5 §3.5). On start: refresh (the HttpOnly cookie, if any) → GET /auth/me → load lookups →
 * render. No token survives a reload, so this is also how a returning user is recognised. Signing out, or the
 * session ending on the server, clears the whole query cache so the next user never sees the last one's data.
 */
export function AuthProvider({ children, client = api, loadLookups }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const loadMe = useCallback(async () => {
    const { data } = await client.get('/auth/me', { schema: MeSchema });
    await loadLookups?.(client);
    setState({ status: 'signed-in', me: data });
    return data;
  }, [client, loadLookups]);

  useEffect(() => {
    const run = { cancelled: false };
    // Read through a function: the flag changes in the cleanup, after the awaits.
    const isCancelled = () => run.cancelled;
    void (async () => {
      const refreshed = await client.refreshOnce();
      if (isCancelled()) return;
      if (!refreshed) {
        setState({ status: 'signed-out', reason: null });
        return;
      }
      try {
        await loadMe();
      } catch {
        if (!isCancelled()) setState({ status: 'signed-out', reason: null });
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, [client, loadMe]);

  useEffect(
    () =>
      onSessionEnd((reason) => {
        queryClient.clear();
        setState({ status: 'signed-out', reason });
      }),
    [queryClient],
  );

  // A 403 PASSWORD_CHANGE_REQUIRED mid-session: mark it, and the route guard sends the user to change it.
  useEffect(
    () =>
      onPasswordChangeRequired(() => {
        setState((previous) =>
          previous.status === 'signed-in' && !previous.me.must_change_password
            ? { status: 'signed-in', me: { ...previous.me, must_change_password: true } }
            : previous,
        );
      }),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: async (credentials) => {
        await apiSignIn(credentials, client);
        return loadMe();
      },
      signOut: async () => {
        await apiSignOut(client);
        queryClient.clear();
        setAccessToken(null);
      },
      signOutEverywhere: async () => {
        await apiSignOutEverywhere(client);
        queryClient.clear();
        setAccessToken(null);
      },
      reload: async () => {
        await loadMe();
      },
    }),
    [state, client, loadMe, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
