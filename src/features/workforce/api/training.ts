import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Training (P2.09): a programme at an estate (induction, safety, a skill), planned as a draft, approved for its cost,
 * then run: participants are registered, their attendance, score, result and certificate recorded, and the programme
 * completed once every attendance is in.
 */

export const TRAINING_TYPES = [
  'induction',
  'safety',
  'technical',
  'skill',
  'compliance',
  'health',
  'leadership',
  'other',
] as const;
export const TRAINER_TYPES = ['internal', 'external'] as const;
export const PROGRAM_STATES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'completed',
  'cancelled',
] as const;
export const ATTENDANCE = ['registered', 'attended', 'absent', 'withdrawn'] as const;
export const RESULTS = ['pass', 'fail', 'not_assessed'] as const;

const Text = z.string().nullable();

export const ProgramSchema = z.looseObject({
  id: z.string(),
  program_code: z.string(),
  estate_id: z.string(),
  estate: z.looseObject({ id: z.string(), code: z.string(), name: z.string() }),
  title: z.string(),
  training_type: z.enum(TRAINING_TYPES),
  trainer_name: Text,
  trainer_type: z.enum(TRAINER_TYPES),
  venue: Text,
  start_date: z.string(),
  end_date: z.string(),
  duration_hours: Text,
  capacity: z.number().int().nullable(),
  cost: Text,
  description: Text,
  participant_count: z.number().int(),
  seats_left: z.number().int().nullable(),
  state: z.enum(PROGRAM_STATES),
  approval_id: Text,
  rejection_reason: Text,
  cancellation_reason: Text,
  version: z.number().int(),
});
export type Program = z.infer<typeof ProgramSchema>;

export const ParticipantSchema = z.looseObject({
  id: z.string(),
  training_program_id: z.string(),
  program: z.looseObject({
    id: z.string(),
    program_code: z.string(),
    title: z.string(),
    start_date: z.string(),
    end_date: z.string(),
  }),
  employment_profile_id: z.string(),
  profile: z.looseObject({ id: z.string(), profile_number: z.string(), full_name: z.string() }),
  attendance_status: z.enum(ATTENDANCE),
  score: Text,
  result: z.enum(RESULTS),
  certificate_number: Text,
  certificate_issued_on: Text,
  feedback_rating: z.number().int().nullable(),
  remarks: Text,
  version: z.number().int(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const programKeys = createQueryKeys('training-programs');

export function useProgramsList() {
  return usePagedList({
    keys: programKeys,
    path: '/training-programs',
    row: ProgramSchema,
    defaultSort: '-start_date',
    pageSize: 25,
  });
}

export function useProgram(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: programKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/training-programs/${id}`, { schema: ProgramSchema, signal })).data,
  });
}

export interface ProgramInput {
  readonly title: string;
  readonly training_type: Program['training_type'];
  readonly trainer_name: string | null;
  readonly trainer_type: Program['trainer_type'];
  readonly venue: string | null;
  readonly start_date: string;
  readonly end_date: string;
  readonly duration_hours: string | null;
  readonly capacity: number | null;
  readonly cost: string | null;
  readonly description: string | null;
}

export function useCreateProgram() {
  return useApiMutation({
    mutationFn: async (input: ProgramInput & { estate_id: string }) =>
      (await api.post('/training-programs', input, { schema: ProgramSchema })).data,
    invalidates: () => [programKeys.all],
  });
}

export function useChangeProgram(subject: string) {
  return useApiMutation({
    mutationFn: async (input: { program: Pick<Program, 'id' | 'version'>; changes: ProgramInput }) =>
      (
        await api.patch(`/training-programs/${input.program.id}`, input.changes, {
          schema: ProgramSchema,
          ifMatch: input.program.version,
        })
      ).data,
    invalidates: () => [programKeys.all],
    conflictSubject: () => subject,
  });
}

/** Submit, complete: transitions of a programme. */
export function useProgramAction(action: 'submit' | 'complete', subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (program: Pick<Program, 'id' | 'version'>) =>
      (
        await api.post(`/training-programs/${program.id}/${action}`, undefined, {
          schema: ProgramSchema,
          versioned: true,
          ifMatch: program.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [programKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useCancelProgram(subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { program: Pick<Program, 'id' | 'version'>; reason: string }) =>
      (
        await api.post(
          `/training-programs/${input.program.id}/cancel`,
          { reason: input.reason },
          {
            schema: ProgramSchema,
            versioned: true,
            ifMatch: input.program.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [programKeys.all],
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteProgram() {
  return useApiMutation({
    mutationFn: async (program: Pick<Program, 'id' | 'version'>) => {
      await api.delete(`/training-programs/${program.id}`, { ifMatch: program.version });
    },
    invalidates: () => [programKeys.lists()],
  });
}

// ---- Participants ----------------------------------------------------------------------------------------

export function useParticipants(programId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: programKeys.sub(programId, 'participants'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/training-programs/${programId}/participants`, {
          schema: z.array(ParticipantSchema),
          signal,
        })
      ).data,
  });
}

/** A profile's training history, latest first (a profile page's Training tab). */
export function useProfileTrainings(profileId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: programKeys.sub(profileId, 'of-profile'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/employment-profiles/${profileId}/trainings`, {
          schema: z.array(ParticipantSchema),
          signal,
        })
      ).data,
  });
}

export function useAddParticipants(programId: string) {
  return useApiMutation({
    mutationFn: async (profileIds: readonly string[]) =>
      (
        await api.post(
          `/training-programs/${programId}/participants`,
          { employment_profile_ids: profileIds },
          { schema: z.array(ParticipantSchema) },
        )
      ).data,
    invalidates: () => [programKeys.all],
  });
}

export interface ResultInput {
  readonly attendance_status: Participant['attendance_status'];
  readonly score: string | null;
  readonly result: Participant['result'];
  readonly certificate_number: string | null;
  readonly certificate_issued_on: string | null;
  readonly feedback_rating: number | null;
  readonly remarks: string | null;
}

export function useRecordParticipant(programId: string, subject: string) {
  return useApiMutation({
    mutationFn: async (input: { participant: Pick<Participant, 'id' | 'version'>; changes: ResultInput }) =>
      (
        await api.patch(
          `/training-programs/${programId}/participants/${input.participant.id}`,
          input.changes,
          { schema: ParticipantSchema, ifMatch: input.participant.version },
        )
      ).data,
    invalidates: () => [programKeys.all],
    conflictSubject: () => subject,
  });
}

export function useRemoveParticipant(programId: string) {
  return useApiMutation({
    mutationFn: async (participant: Pick<Participant, 'id'>) => {
      await api.delete(`/training-programs/${programId}/participants/${participant.id}`);
    },
    invalidates: () => [programKeys.all],
  });
}
