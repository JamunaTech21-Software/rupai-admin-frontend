import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { array as miniArray } from 'zod/mini';

import { api, useIdempotencyKey } from '@/lib/api';
import {
  cachePolicy,
  createQueryKeys,
  type Job,
  jobKeys,
  JobSchema,
  useApiMutation,
  usePagedList,
} from '@/lib/query';

/**
 * Background jobs and the system that runs them (P1.15, P5 §4.7). Following one job is `useJob` (lib/query); here are
 * the lists, retry, the recurring tasks and the processes. A job of someone else is 404 (never 403).
 */

export const jobListKeys = createQueryKeys('jobs');
/** The schedules and the processes live under their own key, refreshed by the actions that change them. */
export const scheduleKeys = createQueryKeys('job-schedules');
export const processKeys = createQueryKeys('job-processes');

/** Jobs, newest first: the user's own, or everyone's with system.view (`filter[mine]=true` for only one's own). */
export function useJobsList() {
  return usePagedList({ keys: jobListKeys, path: '/jobs', row: JobSchema, pageSize: 25 });
}

/** The user's jobs that have not ended, for the top bar. Fetched often while any run, rarely while none do. */
export function useLiveJobs() {
  return useQuery({
    queryKey: [...jobKeys.all, 'live'] as const,
    staleTime: 0,
    queryFn: async ({ signal }) =>
      (
        await api.get('/jobs', {
          query: { 'filter[mine]': 'true', 'filter[state][in]': 'queued,running', per_page: 20 },
          schema: miniArray(JobSchema),
          signal,
        })
      ).data,
    // After queryFn, so the data is typed here.
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 5_000 : 30_000),
  });
}

/** Queue a failed job again, with a fresh set of attempts (system.edit). 409 INVALID_TRANSITION unless it failed. */
export function useRetryJob(job: Pick<Job, 'id'>) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async () =>
      (
        await api.post(`/jobs/${job.id}/retry`, undefined, {
          schema: JobSchema,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [jobKeys.all],
    onSuccess: idempotency.reset,
  });
}

/** Start the system's self-test job (system.edit): `steps` units of `stepMs` each, failing `failAttempts` times. */
export function useStartTestJob() {
  return useApiMutation({
    mutationFn: async (input: { steps: number; stepMs: number; failAttempts: number }) =>
      (
        await api.post(
          '/jobs/self-test',
          { steps: input.steps, step_ms: input.stepMs, fail_attempts: input.failAttempts },
          { schema: JobSchema },
        )
      ).data,
    invalidates: () => [jobKeys.all],
  });
}

// ---- Recurring jobs and processes -----------------------------------------------------------------------

export const ScheduleSchema = z.looseObject({
  name: z.string(),
  description: z.string(),
  job_type: z.string(),
  job_label: z.string(),
  /** Five-field cron, in `timezone`. */
  cron: z.string(),
  timezone: z.string(),
  is_paused: z.boolean(),
  next_run_at: z.string().nullable(),
  last_run_at: z.string().nullable(),
  last_job: z.object({ id: z.string(), state: z.string(), finished_at: z.string().nullable() }).nullable(),
  version: z.number().int(),
});
export type Schedule = z.infer<typeof ScheduleSchema>;

export const ProcessSchema = z.looseObject({
  kind: z.enum(['scheduler', 'worker']),
  key: z.string(),
  host: z.string(),
  pid: z.number().int(),
  app_version: z.string(),
  started_at: z.string(),
  last_beat_at: z.string(),
  stopped_at: z.string().nullable(),
  /** Heard from in the last 90 seconds and not stopped. */
  is_alive: z.boolean(),
});
export type JobProcess = z.infer<typeof ProcessSchema>;

export function useSchedules() {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: scheduleKeys.list('all'),
    queryFn: async ({ signal }) =>
      (await api.get('/system/schedules', { schema: z.array(ScheduleSchema), signal })).data,
  });
}

export function useProcesses() {
  return useQuery({
    ...cachePolicy('live'),
    queryKey: processKeys.list('all'),
    queryFn: async ({ signal }) =>
      (await api.get('/system/processes', { schema: z.array(ProcessSchema), signal })).data,
  });
}

/** Pause or resume a recurring task (system.edit). 409 INVALID_TRANSITION when it already is. */
export function useToggleSchedule(schedule: Pick<Schedule, 'name'>) {
  return useApiMutation({
    mutationFn: async (action: 'pause' | 'resume') =>
      (await api.post(`/system/schedules/${schedule.name}/${action}`, undefined, { schema: ScheduleSchema }))
        .data,
    invalidates: () => [scheduleKeys.all],
  });
}

/** Run a recurring task now (system.edit): answers with the job it started. */
export function useRunSchedule(schedule: Pick<Schedule, 'name'>) {
  return useApiMutation({
    mutationFn: async () =>
      (await api.post(`/system/schedules/${schedule.name}/run`, undefined, { schema: JobSchema })).data,
    invalidates: () => [scheduleKeys.all, jobKeys.all],
  });
}
