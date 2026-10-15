import { http, type RequestHandler } from 'msw';

import { apiError, ok, page, requireAuth } from '@/lib/mocking/contract';
import { type Job } from '@/lib/query';

/**
 * In-memory jobs and recurring tasks (P1.15) for VITE_MOCK_API=jobs and for tests, with the backend's rules: a
 * running job advances on each poll and then completes; a failing test job fails after its first poll; retry works
 * only on a failed job (409 INVALID_TRANSITION) and queues it afresh; pause and resume refuse a task already so.
 */

const NOW = '2026-10-15T04:00:00.000Z';
const ME = { id: 'usr_manager', username: 'manager' };
const OTHER = { id: 'usr_other', username: 'rahim' };

function job(fields: Partial<Job> & Pick<Job, 'id' | 'label' | 'state'>): Job {
  return {
    type: 'export',
    progress: { done: 0, total: 10 },
    poll_after_seconds: null,
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: null,
    queued_at: NOW,
    started_at: NOW,
    finished_at: null,
    result: null,
    error: null,
    requested_by: ME,
    schedule: null,
    expires_at: null,
    ...fields,
  };
}

interface Schedule {
  name: string;
  description: string;
  job_type: string;
  job_label: string;
  cron: string;
  timezone: string;
  is_paused: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_job: { id: string; state: string; finished_at: string | null } | null;
  version: number;
}

let jobs: Job[] = [];
let schedules: Schedule[] = [];
let sequence = 0;
/** Polls seen per job, so a running job advances and a failing test job fails on its second. */
let polls = new Map<string, number>();
const failing = new Set<string>();

function seed() {
  sequence = 0;
  polls = new Map();
  failing.clear();
  jobs = [
    job({
      id: 'j_running',
      label: 'Exporting workers',
      state: 'running',
      progress: { done: 4, total: 10 },
      poll_after_seconds: 5,
      queued_at: '2026-10-15T04:05:00.000Z',
    }),
    job({
      id: 'j_done',
      label: 'Exporting estates',
      state: 'completed',
      progress: { done: 10, total: 10 },
      finished_at: '2026-10-15T04:03:00.000Z',
      result: { download_url: '/api/v1/downloads/estates.xlsx', rows: 12 },
    }),
    job({
      id: 'j_failed',
      label: 'Importing fields',
      type: 'import',
      state: 'failed',
      attempts: 3,
      progress: { done: 2, total: 50 },
      finished_at: '2026-10-15T04:02:00.000Z',
      error: { code: 'IMPORT_FAILED', message: 'The file could not be read.' },
    }),
    job({
      id: 'j_retrying',
      label: 'Sending reminders',
      type: 'notify',
      state: 'queued',
      attempts: 1,
      progress: { done: 0, total: null },
      poll_after_seconds: 5,
      next_attempt_at: '2026-10-15T04:20:00.000Z',
      error: { code: 'MAIL_DOWN', message: 'The mail server did not answer.' },
      requested_by: OTHER,
    }),
    job({
      id: 'j_partial',
      label: 'Importing workers',
      type: 'import',
      state: 'partial',
      progress: { done: 90, total: 100 },
      finished_at: '2026-10-15T04:01:00.000Z',
      result: { imported: 90, refused: [{ row: 4, reason: 'Duplicate employee number' }] },
    }),
    job({
      id: 'j_nightly',
      label: 'Nightly clean-up',
      type: 'cleanup',
      state: 'completed',
      progress: { done: 1, total: 1 },
      finished_at: '2026-10-15T01:00:00.000Z',
      requested_by: null,
      schedule: 'nightly-cleanup',
    }),
  ];
  schedules = [
    {
      name: 'nightly-cleanup',
      description: 'Removes finished jobs and expired files.',
      job_type: 'cleanup',
      job_label: 'Nightly clean-up',
      cron: '0 1 * * *',
      timezone: 'Asia/Dhaka',
      is_paused: false,
      next_run_at: '2026-10-16T01:00:00.000Z',
      last_run_at: '2026-10-15T01:00:00.000Z',
      last_job: { id: 'j_nightly', state: 'completed', finished_at: '2026-10-15T01:00:10.000Z' },
      version: 1,
    },
    {
      name: 'document-expiry',
      description: 'Looks for documents about to expire.',
      job_type: 'document_expiry',
      job_label: 'Document expiry check',
      cron: '0 6 * * *',
      timezone: 'Asia/Dhaka',
      is_paused: true,
      next_run_at: null,
      last_run_at: null,
      last_job: null,
      version: 1,
    },
  ];
}
seed();

export function resetJobMocks(): void {
  seed();
}

const notFound = () => apiError(404, 'NOT_FOUND', 'The job does not exist.');

/** A job moved on by one poll, as the worker would between two requests. */
function advance(row: Job): Job {
  const seen = (polls.get(row.id) ?? 0) + 1;
  polls.set(row.id, seen);
  if (row.state === 'queued' && row.attempts === 0) {
    row.state = 'running';
    row.poll_after_seconds = 5;
  } else if (row.state === 'running') {
    if (failing.has(row.id) && seen >= 2) {
      row.state = 'failed';
      row.attempts = row.max_attempts;
      row.poll_after_seconds = null;
      row.finished_at = new Date().toISOString();
      row.error = { code: 'SELF_TEST_FAILED', message: 'The test job was asked to fail.' };
    } else if (row.progress.total !== null) {
      const { total } = row.progress;
      const done = Math.min(row.progress.done + 3, total);
      row.progress = { done, total };
      if (done >= total) {
        row.state = 'completed';
        row.poll_after_seconds = null;
        row.finished_at = new Date().toISOString();
      }
    }
  }
  return row;
}

export function jobMocks(base = '/api/v1'): RequestHandler[] {
  const find = (id: unknown) => jobs.find((j) => j.id === id);
  const schedule = (name: unknown) => schedules.find((s) => s.name === name);
  return [
    http.get(`${base}/jobs`, ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const params = new URL(request.url).searchParams;
      const state = params.get('filter[state]');
      const states = params.get('filter[state][in]')?.split(',');
      const mine = params.get('filter[mine]') === 'true';
      const rows = [...jobs]
        .reverse()
        .filter((j) => (state ? j.state === state : true))
        .filter((j) => (states ? states.includes(j.state) : true))
        .filter((j) => (mine ? j.requested_by?.id === ME.id : true));
      return page(request, rows);
    }),

    http.get(`${base}/jobs/:id`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = find(params.id);
      return row ? ok(advance(row)) : notFound();
    }),

    http.post(`${base}/jobs/:id/retry`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = find(params.id);
      if (!row) return notFound();
      if (row.state !== 'failed')
        return apiError(409, 'INVALID_TRANSITION', 'Only a failed job can be retried.');
      Object.assign(row, {
        state: 'queued',
        attempts: 0,
        poll_after_seconds: 5,
        finished_at: null,
        error: null,
      });
      failing.delete(row.id);
      polls.set(row.id, 0);
      return ok(row, { status: 202 });
    }),

    http.post(`${base}/jobs/self-test`, async ({ request }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const body = (await request.json()) as { steps?: number; fail_attempts?: number };
      sequence += 1;
      const added = job({
        id: `j_test_${String(sequence)}`,
        label: 'Job system self-test',
        type: 'self_test',
        state: 'queued',
        attempts: 0,
        progress: { done: 0, total: body.steps ?? 10 },
        poll_after_seconds: 5,
        started_at: null,
      });
      if ((body.fail_attempts ?? 0) > 0) failing.add(added.id);
      jobs.push(added);
      return ok(added, { status: 202 });
    }),

    http.get(`${base}/system/schedules`, ({ request }) => requireAuth(request) ?? ok(schedules)),

    ...(['pause', 'resume'] as const).map((action) =>
      http.post(`${base}/system/schedules/:name/${action}`, ({ request, params }) => {
        const refused = requireAuth(request);
        if (refused) return refused;
        const row = schedule(params.name);
        if (!row) return notFound();
        if (row.is_paused === (action === 'pause'))
          return apiError(
            409,
            'INVALID_TRANSITION',
            `It is already ${action === 'pause' ? 'paused' : 'running'}.`,
          );
        row.is_paused = action === 'pause';
        row.version += 1;
        return ok(row);
      }),
    ),

    http.post(`${base}/system/schedules/:name/run`, ({ request, params }) => {
      const refused = requireAuth(request);
      if (refused) return refused;
      const row = schedule(params.name);
      if (!row) return notFound();
      sequence += 1;
      const started = job({
        id: `j_run_${String(sequence)}`,
        label: row.job_label,
        type: row.job_type,
        state: 'queued',
        attempts: 0,
        progress: { done: 0, total: 3 },
        poll_after_seconds: 5,
        started_at: null,
        schedule: row.name,
      });
      jobs.push(started);
      return ok(started, { status: 202 });
    }),

    http.get(
      `${base}/system/processes`,
      ({ request }) =>
        requireAuth(request) ??
        ok([
          {
            kind: 'worker',
            key: 'worker-1',
            host: 'rupai-app',
            pid: 4120,
            app_version: '0.1.0',
            started_at: NOW,
            last_beat_at: NOW,
            stopped_at: null,
            is_alive: true,
          },
          {
            kind: 'scheduler',
            key: 'scheduler-1',
            host: 'rupai-app',
            pid: 4121,
            app_version: '0.1.0',
            started_at: NOW,
            last_beat_at: '2026-10-15T03:50:00.000Z',
            stopped_at: null,
            is_alive: false,
          },
        ]),
    ),
  ];
}

export const handlers: RequestHandler[] = jobMocks();
