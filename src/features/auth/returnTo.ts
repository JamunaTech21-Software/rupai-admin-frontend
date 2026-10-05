/**
 * Where to go after signing in. Only an in-app path is accepted, never another site: `//evil.example` or
 * `https://…` in ?returnTo= falls back to the dashboard (open-redirect protection).
 */
export function safeReturnTo(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/login')) return '/';
  return raw;
}

/** The sign-in address that brings the user back to `path` afterwards. */
export function loginPathFor(path: string): string {
  return path === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(path)}`;
}
