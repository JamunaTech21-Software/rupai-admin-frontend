import { afterEach, describe, expect, it, vi } from 'vitest';

import middleware, { backendBase, backendTarget, config } from '../middleware';

afterEach(() => {
  vi.unstubAllEnvs();
});

const STAGING = 'https://staging-api.example.com';

describe('BACKEND_URL', () => {
  it('accepts an https URL and strips a trailing slash', () => {
    expect(backendBase(STAGING)).toEqual({ base: STAGING });
    expect(backendBase(`  ${STAGING}/ `)).toEqual({ base: STAGING });
    expect(backendBase(`${STAGING}/edge//`)).toEqual({ base: `${STAGING}/edge` });
  });

  it('refuses a missing, malformed or non-https value', () => {
    for (const raw of [
      undefined,
      '',
      'staging-api.example.com',
      'http://staging-api.example.com',
      `${STAGING}?x=1`,
    ]) {
      expect(backendBase(raw)).toHaveProperty('problem');
    }
  });

  it('appends the request path and query', () => {
    expect(
      backendTarget('https://rupai.vercel.app/api/v1/users?filter%5Bstatus%5D=active&page=2', STAGING),
    ).toBe(`${STAGING}/api/v1/users?filter%5Bstatus%5D=active&page=2`);
  });
});

describe('middleware', () => {
  it('only claims the backend paths, so the SPA fallback handles everything else', () => {
    expect(config.matcher).toEqual(['/api/:path*', '/health', '/health/:path*', '/docs', '/docs/:path*']);
  });

  it('rewrites to the backend named by BACKEND_URL, and follows a change without code', () => {
    vi.stubEnv('BACKEND_URL', 'https://backend-one.example.com');
    expect(
      middleware(new Request('https://rupai.vercel.app/api/v1/auth/refresh', { method: 'POST' })).headers.get(
        'x-middleware-rewrite',
      ),
    ).toBe('https://backend-one.example.com/api/v1/auth/refresh');

    vi.stubEnv('BACKEND_URL', 'https://backend-two.example.com/');
    expect(
      middleware(new Request('https://rupai.vercel.app/health/ready')).headers.get('x-middleware-rewrite'),
    ).toBe('https://backend-two.example.com/health/ready');
  });

  it('answers 503 BACKEND_NOT_CONFIGURED when BACKEND_URL is missing or not https', async () => {
    for (const value of ['', 'http://backend.example.com']) {
      vi.stubEnv('BACKEND_URL', value);
      const response = middleware(new Request('https://rupai.vercel.app/api/v1/auth/me'));
      expect(response.status).toBe(503);
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      const body = (await response.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('BACKEND_NOT_CONFIGURED');
      expect(body.error.message).toContain('BACKEND_URL');
    }
  });
});

describe('the app, when the deployment has no BACKEND_URL', () => {
  it('shows the configuration message instead of "server busy", without retrying', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    const { describeError, errorBehaviour } = await import('@/lib/api/behaviour');
    const error = new ApiError({
      status: 503,
      code: 'BACKEND_NOT_CONFIGURED',
      message: 'The app cannot reach its server: BACKEND_URL is not set for this deployment.',
    });
    expect(errorBehaviour(error)).toBe('error-state');
    expect(describeError(error).message).toContain('BACKEND_URL is not set');
    const { shouldRetryQuery } = await import('@/lib/query/queryClient');
    expect(shouldRetryQuery(0, error)).toBe(false);
  });
});
