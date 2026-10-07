/**
 * The access token, held in memory only (Spec P5 §3.5, backend decision D-1.02-1). It is never written to
 * localStorage, sessionStorage or a readable cookie, so a script injected into the page cannot carry it off
 * after the tab closes. The refresh token is an HttpOnly cookie on /api/v1/auth that this code never sees. A
 * reload starts with no access token; the first request gets one through the refresh cookie.
 */
export interface AccessToken {
  readonly token: string;
  /** ISO time the token stops working. */
  readonly expiresAt: string;
}

/** Why the session ended, for the sign-in screen's message. */
export type SessionEndReason = 'expired' | 'signed-out';

type Listener = (reason: SessionEndReason) => void;

let current: AccessToken | null = null;
const endListeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return current?.token ?? null;
}

export function setAccessToken(token: AccessToken | null): void {
  current = token;
}

/** Forgets the token and tells listeners (the auth provider, F0.07) that the session is over. */
export function endSession(reason: SessionEndReason): void {
  current = null;
  for (const listener of endListeners) listener(reason);
}

/** Called when the session ends (refresh failed, or signed out). Returns an unsubscribe function. */
export function onSessionEnd(listener: Listener): () => void {
  endListeners.add(listener);
  return () => {
    endListeners.delete(listener);
  };
}

const passwordListeners = new Set<() => void>();

/**
 * The server answered 403 PASSWORD_CHANGE_REQUIRED (e.g. an administrator reset the password during this
 * session). The auth provider listens and sends the user to the change-password screen.
 */
export function requirePasswordChange(): void {
  for (const listener of passwordListeners) listener();
}

export function onPasswordChangeRequired(listener: () => void): () => void {
  passwordListeners.add(listener);
  return () => {
    passwordListeners.delete(listener);
  };
}

/** The environment the API last reported (X-Environment): `development`, `staging`; null in production. */
let environment: string | null = null;
export function lastEnvironment(): string | null {
  return environment;
}
export function recordEnvironment(value: string | null): void {
  if (value) environment = value;
}
