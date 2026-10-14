import { http, HttpResponse, type RequestHandler } from 'msw';

/**
 * Default request handlers for tests. Contract mocks (lib/mocking/contract.ts) are added per test with
 * `server.use(...)`; this keeps only what every rendered app needs: the liveness check the environment
 * banner reads, and the reference lists the session loads after sign-in (empty unless a test mocks them).
 */
export const handlers: RequestHandler[] = [
  http.get('*/health', () => HttpResponse.json({ status: 'ok' }, { headers: { 'X-Environment': 'test' } })),
  http.get('*/api/v1/lookups', () => HttpResponse.json({ data: {}, meta: { request_id: 'test' } })),
];
