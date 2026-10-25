import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

/**
 * Worker teams (P2.04): a sardar's gang, a field or factory team. A team belongs to an estate; its members are
 * worker profiles of that estate, each for a period (effective-dated), with a role in the team. A worker is in one
 * team at a time.
 */

export const TEAM_TYPES = ['plucking', 'field', 'factory', 'general'] as const;
export const TEAM_ROLES = ['member', 'leader', 'assistant'] as const;
export const TEAM_STATUSES = ['active', 'inactive'] as const;

const Ref = z.looseObject({ id: z.string(), code: z.string(), name: z.string() });
const Text = z.string().nullable();

export const TeamSchema = z.looseObject({
  id: z.string(),
  estate_id: z.string(),
  estate: Ref,
  code: z.string(),
  name: z.string(),
  team_type: z.enum(TEAM_TYPES),
  supervisor_profile_id: Text,
  supervisor: z.looseObject({ id: z.string(), profile_number: z.string(), full_name: z.string() }).nullable(),
  division_id: Text,
  division: Ref.nullable(),
  section_id: Text,
  section: Ref.nullable(),
  description: Text,
  member_count: z.number().int(),
  leader: z
    .looseObject({ profile_id: z.string(), profile_number: z.string(), full_name: z.string() })
    .nullable(),
  status: z.enum(TEAM_STATUSES),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: Text,
});
export type Team = z.infer<typeof TeamSchema>;

export const MemberSchema = z.looseObject({
  id: z.string(),
  worker_team_id: z.string(),
  team: z.looseObject({ id: z.string(), code: z.string(), name: z.string() }),
  employment_profile_id: z.string(),
  profile: z.looseObject({
    id: z.string(),
    profile_number: z.string(),
    full_name: z.string(),
    status: z.string(),
  }),
  effective_from: z.string(),
  effective_to: Text,
  role_in_team: z.enum(TEAM_ROLES),
  is_current: z.boolean(),
  version: z.number().int(),
});
export type Member = z.infer<typeof MemberSchema>;

export const teamKeys = createQueryKeys('worker-teams');
const membersKey = (teamId: string, view: string) => teamKeys.sub(teamId, `members:${view}`);

export function useTeamsList() {
  return usePagedList({
    keys: teamKeys,
    path: '/worker-teams',
    row: TeamSchema,
    defaultSort: 'code',
    pageSize: 25,
  });
}

export function useTeam(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: teamKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/worker-teams/${id}`, { schema: TeamSchema, signal })).data,
  });
}

export interface TeamInput {
  readonly code: string;
  readonly name: string;
  readonly team_type: Team['team_type'];
  readonly supervisor_profile_id: string | null;
  readonly division_id: string | null;
  readonly section_id: string | null;
  readonly description: string | null;
}

export function useCreateTeam() {
  return useApiMutation({
    mutationFn: async (input: TeamInput & { estate_id: string }) =>
      (await api.post('/worker-teams', input, { schema: TeamSchema })).data,
    invalidates: () => [teamKeys.all],
  });
}

export function useUpdateTeam(team: Pick<Team, 'id' | 'version' | 'name'>) {
  return useApiMutation({
    mutationFn: async (input: TeamInput) =>
      (await api.put(`/worker-teams/${team.id}`, input, { schema: TeamSchema, ifMatch: team.version })).data,
    invalidates: () => [teamKeys.all],
    conflictSubject: () => team.name,
  });
}

/** Deactivate (refused while the team has members today: 409) or reactivate. */
export function useSetTeamStatus(team: Pick<Team, 'id' | 'version' | 'name'>) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'deactivate' | 'reactivate') => {
      await api.post(`/worker-teams/${team.id}/${action}`, undefined, {
        versioned: true,
        ifMatch: team.version,
        idempotencyKey: idempotency.key(),
      });
    },
    invalidates: () => [teamKeys.all],
    conflictSubject: () => team.name,
    onSuccess: idempotency.reset,
  });
}

/** Delete a team that never had members; otherwise 422 REFERENCED_RECORD and the answer is to deactivate. */
export function useDeleteTeam(team: Pick<Team, 'id'>) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/worker-teams/${team.id}`);
    },
    invalidates: () => [teamKeys.lists()],
  });
}

// ---- Members (effective-dated) ---------------------------------------------------------------------------

/** The members on a date (today when none is given), the leader first. */
export function useTeamMembers(teamId: string, asOf: string | null) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: membersKey(teamId, asOf ?? 'today'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/worker-teams/${teamId}/members`, {
          query: asOf ? { as_of: asOf } : {},
          schema: z.array(MemberSchema),
          signal,
        })
      ).data,
  });
}

/** Every membership, past and future, latest first. */
export function useTeamHistory(teamId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: membersKey(teamId, 'history'),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/worker-teams/${teamId}/members`, {
          query: { history: 'true' },
          schema: z.array(MemberSchema),
          signal,
        })
      ).data,
  });
}

/** A worker's own memberships (the Teams tab of their profile). */
export function useProfileTeams(profileId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: teamKeys.sub(profileId, 'of-profile'),
    queryFn: async ({ signal }) =>
      (await api.get(`/employment-profiles/${profileId}/teams`, { schema: z.array(MemberSchema), signal }))
        .data,
  });
}

/** Changing members changes the team's count and leader, and every worker's own list. */
const touched = (teamId: string) => () => [teamKeys.all, membersKey(teamId, 'today')];

export interface NewMember {
  readonly employment_profile_id: string;
  readonly effective_from: string;
  readonly role_in_team: (typeof TEAM_ROLES)[number];
}

/** Add workers (all or nothing). A worker still in another team is refused unless `move` is set. */
export function useAddMembers(teamId: string) {
  return useApiMutation({
    mutationFn: async (input: { members: readonly NewMember[]; move: boolean }) =>
      (
        await api.post(
          `/worker-teams/${teamId}/members`,
          { members: input.members, move_from_other_team: input.move },
          { schema: z.array(MemberSchema) },
        )
      ).data,
    invalidates: touched(teamId),
  });
}

/** End a membership: the worker's last day in the team. */
export function useEndMember(teamId: string, subject: string) {
  return useApiMutation({
    mutationFn: async (input: { member: Pick<Member, 'id' | 'version'>; effective_to: string }) =>
      (
        await api.post(
          `/worker-teams/${teamId}/members/${input.member.id}/end`,
          { effective_to: input.effective_to },
          { schema: MemberSchema, versioned: true, ifMatch: input.member.version },
        )
      ).data,
    invalidates: touched(teamId),
    conflictSubject: () => subject,
  });
}

export function useChangeRole(teamId: string, subject: string) {
  return useApiMutation({
    mutationFn: async (input: { member: Pick<Member, 'id' | 'version'>; role: Member['role_in_team'] }) =>
      (
        await api.patch(
          `/worker-teams/${teamId}/members/${input.member.id}`,
          { role_in_team: input.role },
          { schema: MemberSchema, ifMatch: input.member.version },
        )
      ).data,
    invalidates: touched(teamId),
    conflictSubject: () => subject,
  });
}

/** Remove a membership entered in error. */
export function useRemoveMember(teamId: string) {
  return useApiMutation({
    mutationFn: async (member: Pick<Member, 'id'>) => {
      await api.delete(`/worker-teams/${teamId}/members/${member.id}`);
    },
    invalidates: touched(teamId),
  });
}
