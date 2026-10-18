import { http, type RequestHandler } from 'msw';

import { ok, requireAuth } from '@/lib/mocking/contract';

import { type Health } from './health';

/** A health report for VITE_MOCK_API=health and tests: one warning, one critical, one unreadable, a later check. */
const report = (): Health => ({
  status: 'critical',
  as_of: '2026-10-18T04:30:00.000Z',
  took_ms: 12,
  version: {
    app: '0.1.0',
    commit: 'abc1234',
    environment: 'development',
    node: 'v24.14.1',
    uptime_seconds: 3_900,
  },
  checks: [
    { key: 'database', label: 'Database', status: 'ok', value: '3 ms', detail: 'Answers a query.', data: {} },
    {
      key: 'queue',
      label: 'Job queue',
      status: 'ok',
      value: '0 waiting, 1 running',
      detail: 'Moving.',
      data: {},
    },
    {
      key: 'failed_jobs',
      label: 'Failed jobs',
      status: 'warning',
      value: '2 in 24 h',
      detail: 'Look at them.',
      data: {},
    },
    {
      key: 'scheduler',
      label: 'Scheduler',
      status: 'critical',
      value: 'last run 2 h ago',
      detail: 'Not running.',
      data: {},
    },
    {
      key: 'backup',
      label: 'Backup',
      status: 'unknown',
      value: null,
      detail: 'Could not be read.',
      data: {},
    },
    {
      key: 'consistency_checks',
      label: 'Consistency checks',
      status: 'not_applicable',
      value: null,
      detail: 'Not yet: Phase 11 — Reports & consistency.',
      data: {},
    },
  ],
});

export function healthMocks(base = '/api/v1'): RequestHandler[] {
  return [http.get(`${base}/system/health`, ({ request }) => requireAuth(request) ?? ok(report()))];
}

export const handlers: RequestHandler[] = healthMocks();
