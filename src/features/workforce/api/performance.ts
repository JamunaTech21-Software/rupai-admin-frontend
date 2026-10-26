import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Goals and evaluations (P2.10). A goal belongs to a person, a department or an estate, is approved, then moves with
 * the progress recorded against it (it shows as delayed or overdue on its own when it trails its dates). An evaluation
 * scores a person on weighted criteria for a period, is approved, and is locked for good once the employee
 * acknowledges it.
 */

export const GOAL_OWNER_TYPES = ['employment_profile', 'department', 'estate'] as const;
export const GOAL_STATES = [
  'draft',
  'submitted',
  'active',
  'in_progress',
  'delayed',
  'overdue',
  'completed',
  'rejected',
  'cancelled',
] as const;
export const EVALUATION_TYPES = ['annual', 'probation', 'project'] as const;
export const EVALUATION_STATES = ['draft', 'submitted', 'approved', 'rejected', 'acknowledged'] as const;
export const RATINGS = ['outstanding', 'exceeds', 'meets', 'needs_improvement', 'unsatisfactory'] as const;

const Text = z.string().nullable();
const ProfileRef = z.looseObject({ id: z.string(), profile_number: z.string(), full_name: z.string() });

export const GoalSchema = z.looseObject({
  id: z.string(),
  goal_code: z.string(),
  owner_type: z.enum(GOAL_OWNER_TYPES),
  owner_id: z.string(),
  owner_name: Text,
  estate_id: z.string(),
  parent_goal_id: Text,
  title: z.string(),
  description: Text,
  kpi_name: Text,
  measure_unit: Text,
  target_value: Text,
  current_value: z.string(),
  weight: Text,
  start_date: z.string(),
  due_date: z.string(),
  review_date: Text,
  progress_percentage: z.string(),
  state: z.enum(GOAL_STATES),
  approval_id: Text,
  completed_at: Text,
  cancellation_reason: Text,
  rejection_reason: Text,
  version: z.number().int(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const ProgressSchema = z.looseObject({
  id: z.string(),
  goal_id: z.string(),
  progress_date: z.string(),
  value: Text,
  progress_percentage: z.string(),
  note: Text,
  recorded_by: z.looseObject({ id: z.string(), username: z.string() }),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const CalendarSchema = z.looseObject({
  goal_id: z.string(),
  goal_code: z.string(),
  title: z.string(),
  kind: z.enum(['start', 'review', 'due']),
  date: z.string(),
  state: z.enum(GOAL_STATES),
});
export type CalendarEvent = z.infer<typeof CalendarSchema>;

export const OverviewSchema = z.looseObject({
  total: z.number().int(),
  completed: z.number().int(),
  in_progress: z.number().int(),
  delayed: z.number().int(),
  overdue: z.number().int(),
  draft: z.number().int(),
  cancelled: z.number().int(),
});

const LineSchema = z.looseObject({
  id: z.string(),
  criteria_id: z.string(),
  criteria: z.looseObject({ id: z.string(), code: z.string(), name: z.string(), criteria_group: z.string() }),
  goal_id: Text,
  weight: z.string(),
  score: Text,
  max_score: z.string(),
  weighted_score: Text,
  comment: Text,
  sequence: z.number().int(),
});
export type EvaluationLine = z.infer<typeof LineSchema>;

export const EvaluationSchema = z.looseObject({
  id: z.string(),
  evaluation_number: z.string(),
  employment_profile_id: z.string(),
  profile: ProfileRef,
  estate_id: z.string(),
  reviewer_profile_id: Text,
  reviewer: ProfileRef.nullable(),
  period_start: z.string(),
  period_end: z.string(),
  evaluation_type: z.enum(EVALUATION_TYPES),
  overall_score: Text,
  overall_rating: z.enum(RATINGS).nullable(),
  strengths: Text,
  development_needs: Text,
  reviewer_comment: Text,
  employee_comment: Text,
  acknowledged_at: Text,
  lines: z.array(LineSchema),
  state: z.enum(EVALUATION_STATES),
  is_locked: z.boolean(),
  approval_id: Text,
  rejection_reason: Text,
  version: z.number().int(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/** Whether progress can be recorded on a goal in this state. */
export const isLive = (state: Goal['state']) =>
  state === 'active' || state === 'in_progress' || state === 'delayed' || state === 'overdue';

export const goalKeys = createQueryKeys('goals');
export const evaluationKeys = createQueryKeys('evaluations');

// ---- Goals -----------------------------------------------------------------------------------------------

export function useGoalsList() {
  return usePagedList({
    keys: goalKeys,
    path: '/goals',
    row: GoalSchema,
    defaultSort: 'due_date',
    pageSize: 25,
  });
}

export function useGoal(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: goalKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/goals/${id}`, { schema: GoalSchema, signal })).data,
  });
}

/** The figures over the goals the user may see, optionally for one estate. */
export function useGoalOverview(estateId: string | null) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: goalKeys.sub('overview', 'figures', estateId ?? ''),
    queryFn: async ({ signal }) =>
      (
        await api.get('/goals/overview', {
          query: estateId ? { estate_id: estateId } : {},
          schema: OverviewSchema,
          signal,
        })
      ).data,
  });
}

/** Start, review and due dates between two days. */
export function useGoalCalendar(from: string, to: string, estateId: string | null) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: goalKeys.sub('calendar', `${from}:${to}`, estateId ?? ''),
    queryFn: async ({ signal }) =>
      (
        await api.get('/goals/calendar', {
          query: { from, to, ...(estateId ? { estate_id: estateId } : {}) },
          schema: z.array(CalendarSchema),
          signal,
        })
      ).data,
  });
}

export function useGoalProgress(goalId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: goalKeys.sub(goalId, 'progress'),
    queryFn: async ({ signal }) =>
      (await api.get(`/goals/${goalId}/progress`, { schema: z.array(ProgressSchema), signal })).data,
  });
}

export interface GoalInput {
  readonly parent_goal_id: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly kpi_name: string | null;
  readonly measure_unit: string | null;
  readonly target_value: string | null;
  readonly weight: string | null;
  readonly start_date: string;
  readonly due_date: string;
  readonly review_date: string | null;
}

export interface NewGoal extends GoalInput {
  readonly owner_type: Goal['owner_type'];
  readonly owner_id: string;
  readonly estate_id?: string;
}

export function useCreateGoal() {
  return useApiMutation({
    mutationFn: async (input: NewGoal) => (await api.post('/goals', input, { schema: GoalSchema })).data,
    invalidates: () => [goalKeys.all],
  });
}

export function useChangeGoal(subject: string) {
  return useApiMutation({
    mutationFn: async (input: { goal: Pick<Goal, 'id' | 'version'>; changes: GoalInput }) =>
      (
        await api.patch(`/goals/${input.goal.id}`, input.changes, {
          schema: GoalSchema,
          ifMatch: input.goal.version,
        })
      ).data,
    invalidates: () => [goalKeys.all],
    conflictSubject: () => subject,
  });
}

export function useGoalAction(action: 'submit' | 'complete', subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (goal: Pick<Goal, 'id' | 'version'>) =>
      (
        await api.post(`/goals/${goal.id}/${action}`, undefined, {
          schema: GoalSchema,
          versioned: true,
          ifMatch: goal.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [goalKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useCancelGoal(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { goal: Pick<Goal, 'id' | 'version'>; reason: string }) =>
      (
        await api.post(
          `/goals/${input.goal.id}/cancel`,
          { reason: input.reason },
          {
            schema: GoalSchema,
            versioned: true,
            ifMatch: input.goal.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [goalKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteGoal() {
  return useApiMutation({
    mutationFn: async (goal: Pick<Goal, 'id' | 'version'>) => {
      await api.delete(`/goals/${goal.id}`, { ifMatch: goal.version });
    },
    invalidates: () => [goalKeys.lists()],
  });
}

export interface ProgressInput {
  readonly progress_date: string;
  readonly value: string | null;
  readonly progress_percentage?: string;
  readonly note: string | null;
}

export function useRecordProgress(goalId: string) {
  return useApiMutation({
    mutationFn: async (input: ProgressInput) =>
      (await api.post(`/goals/${goalId}/progress`, input, { schema: GoalSchema })).data,
    invalidates: () => [goalKeys.all],
  });
}

// ---- Evaluations -----------------------------------------------------------------------------------------

export function useEvaluationsList() {
  return usePagedList({
    keys: evaluationKeys,
    path: '/evaluations',
    row: EvaluationSchema,
    defaultSort: '-period_end',
    pageSize: 25,
  });
}

export function useEvaluation(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: evaluationKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/evaluations/${id}`, { schema: EvaluationSchema, signal })).data,
  });
}

export interface LineInput {
  readonly criteria_id: string;
  readonly weight?: string;
  readonly score: string | null;
  readonly goal_id?: string | null;
  readonly comment: string | null;
}

export interface EvaluationInput {
  readonly reviewer_profile_id: string | null;
  readonly period_start: string;
  readonly period_end: string;
  readonly evaluation_type: Evaluation['evaluation_type'];
  readonly strengths: string | null;
  readonly development_needs: string | null;
  readonly reviewer_comment: string | null;
}

export function useCreateEvaluation() {
  return useApiMutation({
    mutationFn: async (
      input: EvaluationInput & { employment_profile_id: string; lines: readonly LineInput[] },
    ) => (await api.post('/evaluations', input, { schema: EvaluationSchema })).data,
    invalidates: () => [evaluationKeys.all],
  });
}

/** Change a draft: its details, then its criteria lines (the second call needs the first's new version). */
export function useChangeEvaluation(subject: string) {
  return useApiMutation({
    mutationFn: async (input: {
      evaluation: Pick<Evaluation, 'id' | 'version'>;
      changes: EvaluationInput;
      lines: readonly LineInput[];
    }) => {
      const head = (
        await api.patch(`/evaluations/${input.evaluation.id}`, input.changes, {
          schema: EvaluationSchema,
          ifMatch: input.evaluation.version,
        })
      ).data;
      return (
        await api.put(
          `/evaluations/${input.evaluation.id}/lines`,
          { lines: input.lines },
          { schema: EvaluationSchema, ifMatch: head.version },
        )
      ).data;
    },
    invalidates: () => [evaluationKeys.all],
    conflictSubject: () => subject,
  });
}

export function useSubmitEvaluation(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (evaluation: Pick<Evaluation, 'id' | 'version'>) =>
      (
        await api.post(`/evaluations/${evaluation.id}/submit`, undefined, {
          schema: EvaluationSchema,
          versioned: true,
          ifMatch: evaluation.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [evaluationKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useAcknowledge(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { evaluation: Pick<Evaluation, 'id' | 'version'>; comment: string | null }) =>
      (
        await api.post(
          `/evaluations/${input.evaluation.id}/acknowledge`,
          { employee_comment: input.comment },
          {
            schema: EvaluationSchema,
            versioned: true,
            ifMatch: input.evaluation.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [evaluationKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}
