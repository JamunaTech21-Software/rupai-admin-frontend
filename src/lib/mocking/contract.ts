import { http, HttpResponse, type RequestHandler } from 'msw';

/**
 * MSW building blocks that follow the API contract (Spec P4; backend/src/core/http/response.ts and
 * list-query.ts), so a feature can mock an endpoint before the backend has it and switch to the real one
 * without changing its client code. Used by features' api/mocks.ts (VITE_MOCK_API) and by tests. Never part of
 * the production bundle: only mock modules import it, and those load dynamically in development.
 *
 *   http.get(`${base}/workers`, ({ request }) => page(request, queryList(WORKERS, request)))
 */

let counter = 0;
const requestId = () => `mock_${Date.now().toString(36)}_${String((counter += 1))}`;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { 'X-Request-Id': requestId(), 'X-Environment': 'mock', ...extra };
}

const meta = (id: string) => ({ request_id: id, server_time: new Date().toISOString() });

/** 200 with one resource; with `version` it also sends the ETag the client reads for If-Match. */
export function ok(data: unknown, options: { readonly version?: number; readonly status?: number } = {}) {
  const h = headers(options.version !== undefined ? { ETag: `"${String(options.version)}"` } : {});
  return HttpResponse.json(
    { data, meta: meta(h['X-Request-Id'] ?? '') },
    { status: options.status ?? 200, headers: h },
  );
}

/** 201 Created with Location. */
export function created(data: unknown, location: string, version?: number) {
  const h = headers({
    Location: location,
    ...(version !== undefined ? { ETag: `"${String(version)}"` } : {}),
  });
  return HttpResponse.json({ data, meta: meta(h['X-Request-Id'] ?? '') }, { status: 201, headers: h });
}

/** 202 Accepted with a job resource (deferred work). */
export function accepted(job: unknown) {
  return ok(job, { status: 202 });
}

export function noContent() {
  return new HttpResponse(null, { status: 204, headers: headers() });
}

/** The error envelope `{ error: { code, message, details, request_id } }`. */
export function apiError(
  status: number,
  code: string,
  message: string,
  details: readonly {
    field?: string;
    code: string;
    message: string;
    context?: Record<string, unknown>;
  }[] = [],
  extraHeaders: Record<string, string> = {},
) {
  const h = headers(extraHeaders);
  return HttpResponse.json(
    { error: { code, message, details, request_id: h['X-Request-Id'] } },
    { status, headers: h },
  );
}

// ---- Lists ----------------------------------------------------------------------------------------------

type Row = Readonly<Record<string, unknown>>;

/** A field's value as the API compares it: scalars as text, missing as null. */
function scalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Applies the list grammar to in-memory rows: `filter[f]`, `filter[f][in]`, `filter[f][like]` (prefix),
 * `filter[f][from]` / `[to]`, `filter[f][null]`, and `sort=a,-b`.
 */
export function queryList<T extends Row>(rows: readonly T[], request: Request): T[] {
  const params = new URL(request.url).searchParams;
  let result = [...rows];
  for (const [key, value] of params) {
    const match = /^filter\[([a-z0-9_]+)\](?:\[([a-z]+)\])?$/.exec(key);
    if (!match?.[1]) continue;
    const field = match[1];
    const op = match[2] ?? 'eq';
    result = result.filter((row) => {
      const v = scalar(row[field]);
      switch (op) {
        case 'in':
          return v !== null && value.split(',').includes(v);
        case 'like':
          return v?.toLowerCase().startsWith(value.toLowerCase()) ?? false;
        case 'from':
          return v !== null && v >= value;
        case 'to':
          return v !== null && v <= value;
        case 'null':
          return value === 'true' ? v === null : v !== null;
        default:
          return v === value;
      }
    });
  }
  const sort = params.get('sort');
  if (sort) {
    const terms = sort
      .split(',')
      .map((t) => (t.startsWith('-') ? { f: t.slice(1), dir: -1 } : { f: t, dir: 1 }));
    result.sort((a, b) => {
      for (const { f, dir } of terms) {
        const cmp = (scalar(a[f]) ?? '').localeCompare(scalar(b[f]) ?? '', undefined, { numeric: true });
        if (cmp !== 0) return cmp * dir;
      }
      return 0;
    });
  }
  return result;
}

/** A page-based collection: slices by `page` / `per_page` (default 25, max 200) with pagination meta and links. */
export function page(request: Request, rows: readonly unknown[]) {
  const url = new URL(request.url);
  const perPage = Math.min(
    Math.max(Number.parseInt(url.searchParams.get('per_page') ?? '25', 10) || 25, 1),
    200,
  );
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(
    Math.max(Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1),
    lastPage,
  );
  const link = (p: number) => {
    const next = new URL(url);
    next.searchParams.set('page', String(p));
    next.searchParams.set('per_page', String(perPage));
    return `${next.pathname}${next.search}`;
  };
  const h = headers();
  return HttpResponse.json(
    {
      data: rows.slice((current - 1) * perPage, current * perPage),
      meta: {
        ...meta(h['X-Request-Id'] ?? ''),
        pagination: { page: current, per_page: perPage, total: rows.length, last_page: lastPage },
      },
      links: {
        first: link(1),
        prev: current > 1 ? link(current - 1) : null,
        next: current < lastPage ? link(current + 1) : null,
        last: link(lastPage),
      },
    },
    { headers: h },
  );
}

/** A cursor collection: the cursor is the offset, opaque to the client; no total. */
export function cursorPage(request: Request, rows: readonly unknown[]) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200);
  const offset = Number.parseInt(atob(url.searchParams.get('cursor') ?? btoa('0')), 10) || 0;
  const next = offset + limit < rows.length ? btoa(String(offset + limit)) : null;
  const h = headers();
  return HttpResponse.json(
    {
      data: rows.slice(offset, offset + limit),
      meta: { ...meta(h['X-Request-Id'] ?? ''), cursor: { limit, next_cursor: next } },
    },
    { headers: h },
  );
}

// ---- Guards ---------------------------------------------------------------------------------------------

/** 401 UNAUTHENTICATED unless the request carries a token the mock session issued. */
export function requireAuth(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token || !mockSession.tokens.has(token)) {
    return apiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return null;
}

/**
 * Optimistic concurrency like the backend (P4 §5.1): no If-Match → 422 PRECONDITION_REQUIRED; a stale version →
 * 409 VERSION_CONFLICT with the current version in the details' context.
 */
export function requireIfMatch(request: Request, currentVersion: number) {
  const raw = request.headers.get('If-Match');
  if (!raw) {
    return apiError(
      422,
      'PRECONDITION_REQUIRED',
      'This change requires an If-Match header with the current version.',
      [{ code: 'PRECONDITION_REQUIRED', message: 'Send If-Match with the version you last read.' }],
    );
  }
  const version = Number.parseInt(raw.replace(/^(?:W\/)?"?|"?$/g, ''), 10);
  if (version !== currentVersion) {
    return apiError(409, 'VERSION_CONFLICT', 'The record was changed by someone else since you read it.', [
      {
        code: 'VERSION_CONFLICT',
        message: 'Reload the record and reapply your changes.',
        context: { version: currentVersion },
      },
    ]);
  }
  return null;
}

// ---- Auth ---------------------------------------------------------------------------------------------------

/** The mock's sign-in state. The real refresh cookie is HttpOnly; here "has a session" stands in for it. */
export const mockSession = {
  tokens: new Set<string>(),
  signedIn: null as null | { userId: string; username: string },
  refreshCalls: 0,
  /** Accounts that changed their temporary password in this session. */
  passwordChanged: new Set<string>(),
  /** The signed-in user's sessions on other devices (GET /auth/sessions lists them after the current one). */
  otherSessions: seedOtherSessions(),
};

interface MockSessionRow {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

/** Two other devices: a phone and a laptop. */
function seedOtherSessions(): MockSessionRow[] {
  return [
    {
      id: 'ses_phone',
      created_at: '2026-10-01T03:00:00.000Z',
      last_used_at: '2026-10-06T09:30:00.000Z',
      expires_at: '2026-10-31T03:00:00.000Z',
      ip_address: '103.4.145.10',
      user_agent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36',
    },
    {
      id: 'ses_laptop',
      created_at: '2026-09-28T05:00:00.000Z',
      last_used_at: '2026-10-05T11:00:00.000Z',
      expires_at: '2026-10-28T05:00:00.000Z',
      ip_address: null,
      user_agent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
    },
  ];
}

/** Back to "nobody signed in" (between tests, or a fresh mock session). */
export function resetMockSession(): void {
  mockSession.tokens.clear();
  mockSession.signedIn = null;
  mockSession.refreshCalls = 0;
  mockSession.passwordChanged.clear();
  mockSession.otherSessions = seedOtherSessions();
}

export const MOCK_USERS = [
  {
    id: 'usr_manager',
    username: 'manager',
    full_name: 'Demo Manager',
    email: 'manager@example.com',
    permissions: ['*'],
  },
  {
    id: 'usr_viewer',
    username: 'viewer',
    full_name: 'Demo Viewer',
    email: 'viewer@example.com',
    permissions: [],
  },
  {
    id: 'usr_trainee',
    username: 'trainee',
    full_name: 'Demo Trainee',
    email: 'trainee@example.com',
    permissions: ['user.view'],
    mustChangePassword: true,
  },
] as const;

function mustChange(userId: string): boolean {
  const user = MOCK_USERS.find((u) => u.id === userId);
  return Boolean(user && 'mustChangePassword' in user && !mockSession.passwordChanged.has(userId));
}

/** Every mock account's password. */
export const MOCK_PASSWORD = 'Demo-Password-1';

function issueToken(user: { id: string; username: string }) {
  const token = `mock-token-${user.username}-${String((counter += 1))}`;
  mockSession.tokens.add(token);
  mockSession.signedIn = { userId: user.id, username: user.username };
  const expires = new Date(Date.now() + 15 * 60_000);
  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: 900,
    expires_at: expires.toISOString(),
    session_id: `ses_${user.username}`,
    must_change_password: mustChange(user.id),
    user: { id: user.id, username: user.username },
  };
}

/** /auth/login, /auth/refresh, /auth/logout and /auth/me, with the demo accounts `manager` and `viewer`. */
export function authMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.post(`${base}/auth/login`, async ({ request }) => {
      const body = (await request.json().catch(() => null)) as {
        username?: string;
        password?: string;
      } | null;
      // Two extra accounts for the refusal paths: locked after failed attempts, and disabled.
      if (body?.password === MOCK_PASSWORD && body.username === 'locked') {
        return apiError(401, 'ACCOUNT_LOCKED', 'Too many failed sign-ins. The account is locked for now.', [
          {
            code: 'ACCOUNT_LOCKED',
            message: 'Try again in 10 minutes, or ask an administrator.',
            context: { retry_after_seconds: 540 },
          },
        ]);
      }
      if (body?.password === MOCK_PASSWORD && body.username === 'disabled') {
        return apiError(401, 'ACCOUNT_LOCKED', 'This account is disabled.', [
          { code: 'ACCOUNT_DISABLED', message: 'Ask an administrator to re-enable it.' },
        ]);
      }
      const user = MOCK_USERS.find((u) => u.username === body?.username);
      if (!user || body?.password !== MOCK_PASSWORD) {
        return apiError(401, 'INVALID_CREDENTIALS', 'The username or password is not correct.');
      }
      return ok(issueToken(user));
    }),
    http.post(`${base}/auth/refresh`, () => {
      mockSession.refreshCalls += 1;
      const signedIn = mockSession.signedIn;
      if (!signedIn) return apiError(401, 'UNAUTHENTICATED', 'There is no session to refresh.');
      return ok(issueToken({ id: signedIn.userId, username: signedIn.username }));
    }),
    http.post(`${base}/auth/logout`, () => {
      mockSession.tokens.clear();
      mockSession.signedIn = null;
      return noContent();
    }),
    http.post(`${base}/auth/logout-all`, ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      mockSession.tokens.clear();
      mockSession.signedIn = null;
      mockSession.otherSessions = [];
      return noContent();
    }),
    http.get(`${base}/auth/sessions`, ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const now = new Date().toISOString();
      const current = {
        id: `ses_${mockSession.signedIn?.username ?? 'me'}`,
        created_at: now,
        last_used_at: now,
        expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36',
        current: true,
      };
      return page(request, [
        current,
        ...mockSession.otherSessions.map((row) => ({ ...row, current: false })),
      ]);
    }),
    http.delete(`${base}/auth/sessions/:id`, ({ request, params }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const before = mockSession.otherSessions.length;
      mockSession.otherSessions = mockSession.otherSessions.filter((row) => row.id !== params.id);
      if (mockSession.otherSessions.length === before)
        return apiError(404, 'NOT_FOUND', 'Session not found.');
      return noContent();
    }),
    // Always 202 with the same message, whether or not the address exists (no account enumeration).
    http.post(`${base}/auth/password/forgot`, () =>
      ok({ message: 'If the address belongs to an account, a reset link has been sent.' }, { status: 202 }),
    ),
    http.post(`${base}/auth/password/reset`, async ({ request }) => {
      const body = (await request.json().catch(() => null)) as {
        token?: string;
        new_password?: string;
      } | null;
      if (!body?.token || body.token.length < 20) {
        return apiError(422, 'VALIDATION_FAILED', 'The reset link is not valid or has expired.', [
          { field: 'token', code: 'INVALID_TOKEN', message: 'Ask for a new reset link.' },
        ]);
      }
      if (!body.new_password || body.new_password.length < 12) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is invalid.', [
          { field: 'new_password', code: 'TOO_SHORT', message: 'Must be at least 12 characters.' },
        ]);
      }
      return noContent();
    }),
    http.post(`${base}/auth/password/change`, async ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const body = (await request.json().catch(() => null)) as { current_password?: string } | null;
      if (body?.current_password !== MOCK_PASSWORD) {
        return apiError(422, 'VALIDATION_FAILED', 'The request is invalid.', [
          {
            field: 'current_password',
            code: 'INVALID_CREDENTIALS',
            message: 'The current password is not correct.',
          },
        ]);
      }
      if (mockSession.signedIn) mockSession.passwordChanged.add(mockSession.signedIn.userId);
      return noContent();
    }),
    http.get(`${base}/auth/me`, ({ request }) => {
      const denied = requireAuth(request);
      if (denied) return denied;
      const user = MOCK_USERS.find((u) => u.id === mockSession.signedIn?.userId) ?? MOCK_USERS[0];
      return ok({
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          status: 'active',
          roles:
            user.id === 'usr_manager'
              ? [{ id: '1', code: 'ADMINISTRATOR', name: 'System Administrator' }]
              : [],
        },
        permissions: [...user.permissions],
        // manager is unrestricted; viewer is scoped to two estates (the top-bar selector); trainee to none.
        scope: {
          all_estates: user.id === 'usr_manager',
          estates: user.id === 'usr_viewer' ? ['3', '7'] : [],
          divisions: [],
          sections: [],
          departments: [],
          facilities: [],
          self_employment_profile_id: null,
        },
        session_id: `ses_${user.username}`,
        must_change_password: mustChange(user.id),
      });
    }),
  ];
}

/** Expires every issued token, as if 15 minutes had passed: the next call gets 401 and must refresh. */
export function expireMockTokens(): void {
  mockSession.tokens.clear();
}

// ---- Jobs ---------------------------------------------------------------------------------------------------

/** GET /jobs/:id for jobs started with `startMockJob`: each poll advances it, and it succeeds after `steps`. */
const jobs = new Map<string, { polls: number; steps: number; type: string }>();

export function startMockJob(type: string, steps = 4) {
  const id = `job_${String((counter += 1))}`;
  jobs.set(id, { polls: 0, steps, type });
  return { id, type, status: 'queued' as const, progress: 0, created_at: new Date().toISOString() };
}

export function jobMocks(base = '/api/v1'): RequestHandler[] {
  return [
    http.get(`${base}/jobs/:id`, ({ params }) => {
      const job = jobs.get(String(params.id));
      if (!job) return apiError(404, 'NOT_FOUND', 'No such job.');
      job.polls += 1;
      const done = job.polls >= job.steps;
      return ok({
        id: String(params.id),
        type: job.type,
        status: done ? 'succeeded' : 'running',
        progress: Math.min(100, Math.round((job.polls / job.steps) * 100)),
        result_url: done ? `/downloads/${String(params.id)}.xlsx` : null,
        error: null,
        finished_at: done ? new Date().toISOString() : null,
      });
    }),
  ];
}
