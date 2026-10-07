import { rewrite } from '@vercel/functions';

/**
 * Vercel Routing Middleware (P0.08b, RUP-408): forwards the API to the backend named by the BACKEND_URL
 * environment variable, instead of a backend address written into the repository.
 *
 * The staging backend's address changes (a temporary tunnel until a domain exists). With this, a new address is
 * a Vercel setting — Project → Settings → Environment Variables → BACKEND_URL, then Redeploy — never a code
 * change. The browser only ever talks to the Vercel domain (VITE_API_BASE_URL stays /api/v1): the HttpOnly
 * refresh cookie (SameSite=Strict, path /api/v1/auth) stays first-party, and there is no CORS.
 *
 * Runs only on Vercel, before the static files and vercel.json's SPA fallback. Local development uses the Vite
 * proxy (VITE_API_PROXY_TARGET) and never loads this file.
 */

/** Paths that belong to the backend. Everything else is the single-page app. */
export const config = {
  matcher: ['/api/:path*', '/health', '/health/:path*', '/docs', '/docs/:path*'],
};

/** BACKEND_URL without a trailing slash, or why it cannot be used. Only https is accepted. */
export function backendBase(raw: string | undefined): { base: string } | { problem: string } {
  const value = raw?.trim();
  if (!value) return { problem: 'BACKEND_URL is not set for this deployment.' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { problem: 'BACKEND_URL is not a valid URL.' };
  }
  if (url.protocol !== 'https:') return { problem: 'BACKEND_URL must be an https URL.' };
  if (url.search || url.hash) return { problem: 'BACKEND_URL must not contain a query or fragment.' };
  return { base: `${url.origin}${url.pathname}`.replace(/\/+$/, '') };
}

/** Where a request goes on the backend: BACKEND_URL + the request's own path and query. */
export function backendTarget(requestUrl: string, base: string): string {
  const url = new URL(requestUrl);
  return `${base}${url.pathname}${url.search}`;
}

/** A clear JSON answer when the deployment is not configured, in the API's error envelope. */
function notConfigured(problem: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'BACKEND_NOT_CONFIGURED',
        message: `The app cannot reach its server: ${problem} Set BACKEND_URL in Vercel and redeploy.`,
        details: [],
        request_id: 'vercel-middleware',
      },
    }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}

export default function middleware(request: Request): Response {
  const backend = backendBase(process.env.BACKEND_URL);
  if ('problem' in backend) return notConfigured(backend.problem);
  // A rewrite, not a redirect: Vercel proxies the request (method, headers and body unchanged) and streams
  // the answer back on this origin, Set-Cookie included, so the session cookie lives on the Vercel domain.
  return rewrite(backendTarget(request.url, backend.base));
}
