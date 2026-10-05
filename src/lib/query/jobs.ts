import { useQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import * as z from 'zod/mini';

import { api, type ApiClient } from '../api';

/**
 * Deferred work (Spec P4 §5.3): an endpoint that cannot finish at once answers 202 with a job resource, and
 * the client polls GET /jobs/{id} until it ends. The backend's jobs endpoint is not built yet; this follows the
 * contract and is exercised with MSW until it is.
 */
export const JobSchema = z.object({
  id: z.string(),
  type: z.optional(z.string()),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  /** 0–100 when the job reports it. */
  progress: z.optional(z.nullable(z.number())),
  /** Where the result is, for an export or a report. */
  result_url: z.optional(z.nullable(z.string())),
  error: z.optional(z.nullable(z.object({ code: z.string(), message: z.string() }))),
  created_at: z.optional(z.string()),
  finished_at: z.optional(z.nullable(z.string())),
});
export type Job = z.infer<typeof JobSchema>;

const TERMINAL = new Set<Job['status']>(['succeeded', 'failed', 'cancelled']);
export const isJobFinished = (job: Job | undefined): boolean => job !== undefined && TERMINAL.has(job.status);

/** Polling backoff: 1 s, then ×1.5 per poll, at most 10 s. A long payroll run is not polled every second. */
export function jobPollDelay(pollsSoFar: number): number {
  return Math.min(Math.round(1000 * 1.5 ** pollsSoFar), 10_000);
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

/** The jobs still running in this tab, newest last. */
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

/**
 * Follows one job until it ends, polling with backoff, and lists it in the top bar while it runs.
 *
 *   const job = useJob(accepted?.id ?? null, { label: 'Exporting workers' });
 *   if (job.data?.status === 'succeeded') …
 */
export function useJob(
  jobId: string | null,
  options: { readonly label: string; readonly client?: ApiClient },
) {
  const client = options.client ?? api;
  const query = useQuery({
    queryKey: ['jobs', 'detail', jobId ?? ''] as const,
    enabled: jobId !== null,
    staleTime: 0,
    gcTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      (await client.get(`/jobs/${jobId ?? ''}`, { schema: JobSchema, signal })).data,
    refetchInterval: (q) => (isJobFinished(q.state.data) ? false : jobPollDelay(q.state.dataUpdateCount)),
    refetchIntervalInBackground: true,
  });

  const job = query.data;
  const label = options.label;
  useEffect(() => {
    if (!jobId) return;
    if (isJobFinished(job)) removeRunning(jobId);
    else upsertRunning({ id: jobId, label, progress: job?.progress ?? null });
  }, [jobId, job, label]);

  // Leaving the screen does not cancel the job, but this tab stops showing it.
  useEffect(
    () => () => {
      if (jobId) removeRunning(jobId);
    },
    [jobId],
  );

  return query;
}
