import { http, HttpResponse, type RequestHandler } from 'msw';

/**
 * Mocks for the system feature, used when VITE_MOCK_API includes `system` (or is `all`). They follow the
 * backend's contract: the `{ data, meta }` envelope and the X-Environment header.
 */
export const handlers: RequestHandler[] = [
  http.get('/health', () =>
    HttpResponse.json(
      { data: { status: 'ok', version: '0.0.0-mock', commit: 'mock', uptime_seconds: 0 } },
      { headers: { 'X-Environment': 'development' } },
    ),
  ),
  http.get('/health/ready', () =>
    HttpResponse.json(
      { data: { status: 'ready', checks: { database: 'ok', redis: 'ok' } } },
      { headers: { 'X-Environment': 'development' } },
    ),
  ),
];
