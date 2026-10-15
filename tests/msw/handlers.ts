import { http, HttpResponse, type RequestHandler } from 'msw';

/**
 * Default request handlers for tests. Contract mocks (lib/mocking/contract.ts) are added per test with
 * `server.use(...)`; this keeps only what every rendered app needs: the liveness check the environment
 * banner reads, and the reference lists the session loads after sign-in (empty unless a test mocks them).
 */
export const handlers: RequestHandler[] = [
  http.get('*/health', () => HttpResponse.json({ status: 'ok' }, { headers: { 'X-Environment': 'test' } })),
  http.get('*/api/v1/lookups', () => HttpResponse.json({ data: {}, meta: { request_id: 'test' } })),
  // The top bar asks for the user's running jobs; no job unless a test starts one.
  http.get('*/api/v1/jobs', () => HttpResponse.json({ data: [], meta: { request_id: 'test' } })),
  // …and for the bell's unread count; none unless a test brings the notification mocks.
  http.get('*/api/v1/notifications/summary', () =>
    HttpResponse.json({
      data: { unread: 0, unread_critical: 0, latest_at: null },
      meta: { request_id: 'test' },
    }),
  ),
  // …and for how many approvals await them; none unless a test brings the approval mocks.
  http.get('*/api/v1/approvals/pending/count', () =>
    HttpResponse.json({ data: { count: 0 }, meta: { request_id: 'test' } }),
  ),
];
