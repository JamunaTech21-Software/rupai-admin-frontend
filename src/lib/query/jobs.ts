import { type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as z from 'zod/mini';

import { api, type ApiClient } from '../api';

/**
 * Deferred work (Spec P4 §5.3, P5 §4.7): an endpoint that cannot finish at once answers 202 with a job resource,
 * and the client polls GET /jobs/{id} until it ends. States: queued, running, then completed, failed or partial
 * (some items done, some refused: the result carries the report). A queued job with attempts > 0 is waiting to
 * retry, with the last error and next_attempt_at.
 */
export const JOB_STATES = ['queued', 'running', 'completed', 'failed', 'partial'] as const;
export type JobState = (typeof JOB_STATES)[number];

export const JobSchema = z.object({
  id: z.string(),
  type: z.string(),
  /** What it is, for people: "Exporting workers". */
  label: z.string(),
  state: z.enum(JOB_STATES),
  /** total is null until the job knows it. */
  progress: z.object({ done: z.number(), total: z.nullable(z.number()) }),
  poll_after_seconds: z.nullable(z.number()),
  attempts: z.number(),
  max_attempts: z.number(),
  next_attempt_at: z.nullable(z.string()),
  queued_at: z.string(),
  started_at: z.nullable(z.string()),
  finished_at: z.nullable(z.string()),
  /** completed and partial: a summary, a report, or a link to what was produced. */
  result: z.nullable(z.record(z.string(), z.unknown())),
  /** failed: why. While waiting to retry: why the last attempt failed. */
  error: z.nullable(z.object({ code: z.string(), message: z.string() })),
  requested_by: z.nullable(z.object({ id: z.string(), username: z.string() })),
  /** Set when the scheduler started it. */
  schedule: z.nullable(z.string()),
  expires_at: z.nullable(z.string()),
});
export type Job = z.infer<typeof JobSchema>;

export const isJobFinished = (job: Pick<Job, 'state'> | undefined): boolean =>
  job !== undefined && job.state !== 'queued' && job.state !== 'running';

/** Queued again after a failed attempt: waiting for next_attempt_at. */
export const isJobRetrying = (job: Pick<Job, 'state' | 'attempts'>): boolean =>
  job.state === 'queued' && job.attempts > 0;

/** How far along, 0–100, or null while the total is not known. */
export function jobPercent(job: Pick<Job, 'progress'>): number | null {
  const { done, total } = job.progress;
  if (total === null || total <= 0) return null;
  return Math.min(100, Math.round((done * 100) / total));
}

/** Polling backoff (P5 §4.7): 2 s, then ×1.5 per poll, at most 10 s. A long payroll run is not polled every second. */
export function jobPollDelay(pollsSoFar: number): number {
  return Math.min(Math.round(2000 * 1.5 ** pollsSoFar), 10_000);
}

// ---- Running jobs, for the top bar ----------------------------------------------------------------------

export interface RunningJob {
  readonly id: string;
  /** What it is, for the top bar: "Exporting workers". */
  readonly label: string;
  readonly progress: number | null;
}

let running: readonly RunningJob[] = [];
const listeners = new Set<() => void>();
function setRunning(next: readonly RunningJob[]) {
  running = next;
  for (const listener of listeners) listener();
}
function upsertRunning(job: RunningJob) {
  setRunning([...running.filter((j) => j.id !== job.id), job]);
}
function removeRunning(id: string) {
  if (running.some((j) => j.id === id)) setRunning(running.filter((j) => j.id !== id));
}

/** The jobs this tab is following that have not ended yet, newest last. */
export function useRunningJobs(): readonly RunningJob[] {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => running,
    () => running,
  );
}

export const jobKeys = {
  all: ['jobs'] as const,
  detail: (id: string) => ['jobs', 'detail', id] as const,
};

/**
 * Follows one job until it ends, polling with backoff, and lists it in the top bar while it runs. A job keeps
 * running when the user leaves the screen; the top bar finds it again from the server's list.
 *
 *   const job = useJob(accepted?.id ?? null, { invalidates: [workerKeys.all] });
 *   if (job.data?.state === 'completed') …
 *
 * `invalidates` are refreshed once when the job ends, so the screens it changed show the new data.
 */
export function useJob(
  jobId: string | null,
  options: {
    /** Shown in the top bar until the job's own label arrives. */
    readonly label?: string;
    readonly client?: ApiClient;
    readonly invalidates?: readonly QueryKey[];
  } = {},
) {
  const client = options.client ?? api;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: jobKeys.detail(jobId ?? ''),
    enabled: jobId !== null,
    staleTime: 0,
    gcTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      (await client.get(`/jobs/${jobId ?? ''}`, { schema: JobSchema, signal })).data,
    refetchInterval: (q) => (isJobFinished(q.state.data) ? false : jobPollDelay(q.state.dataUpdateCount)),
    refetchIntervalInBackground: true,
  });

  const job = query.data;
  const label = job?.label ?? options.label ?? '';
  const percent = job ? jobPercent(job) : null;
  const refreshed = useRef<string | null>(null);
  const { invalidates } = options;
  useEffect(() => {
    if (!jobId) return;
    if (isJobFinished(job)) {
      removeRunning(jobId);
      if (refreshed.current !== jobId) {
        refreshed.current = jobId;
        for (const key of invalidates ?? []) void queryClient.invalidateQueries({ queryKey: key });
      }
    } else upsertRunning({ id: jobId, label, progress: percent });
  }, [jobId, job, label, percent, invalidates, queryClient]);

  // Leaving the screen does not cancel the job, but this tab stops following it here.
  useEffect(
    () => () => {
      if (jobId) removeRunning(jobId);
    },
    [jobId],
  );

  return query;
}
