import { type RequestHandler } from 'msw';

/**
 * Default request handlers for tests. F0.06 adds handlers that follow the API contract (Spec P4: envelopes,
 * error codes, pagination, auth). Tests override them per case with `server.use(...)`.
 */
export const handlers: RequestHandler[] = [];
