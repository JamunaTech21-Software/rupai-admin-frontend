import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';
import { filterKey } from '@/lib/urlState';

import { personKeys } from './persons';
import {
  type EmploymentType,
  type Profile,
  ProfileSchema,
  type SEPARATION_TYPES,
  ServiceSummarySchema,
  WorkforceSummarySchema,
} from './profileSchemas';

export const profileKeys = createQueryKeys('employment-profiles');

/**
 * The workforce list (employment.view): every profile the user may see, a page at a time. `type` fixes the list to
 * workers or employees (the design has a page for each); without it the list shows both and has a type filter.
 */
export function useProfilesList(type?: EmploymentType) {
  return usePagedList({
    keys: profileKeys,
    path: '/employment-profiles',
    row: ProfileSchema,
    defaultSort: '-joining_date',
    pageSize: 25,
    ...(type ? { defaultFilters: { [filterKey('employment_type')]: type } } : {}),
  });
}

export function useProfile(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: profileKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/employment-profiles/${id}`, { schema: ProfileSchema, signal })).data,
  });
}

/** The cards and charts, for the type (and estate) the list is showing. */
export function useWorkforceSummary(type: EmploymentType | undefined, estateId: string | undefined) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: profileKeys.sub('summary', `${type ?? 'all'}:${estateId ?? 'all'}`),
    queryFn: async ({ signal }) =>
      (
        await api.get('/employment-profiles/summary', {
          query: {
            ...(type ? { employment_type: type } : {}),
            ...(estateId ? { estate_id: estateId } : {}),
          },
          schema: WorkforceSummarySchema,
          signal,
        })
      ).data,
  });
}

/** One estate's profiles, to pick a supervisor ("Reporting to") from. */
export function useEstateProfiles(estateId: string | null) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: profileKeys.list(`estate:${estateId ?? ''}`),
    enabled: estateId !== null && estateId !== '',
    queryFn: async ({ signal }) =>
      (
        await api.get('/employment-profiles', {
          query: {
            'filter[estate_id]': estateId ?? '',
            'filter[status][in]': 'active,suspended,on_leave',
            per_page: 200,
          },
          schema: z.array(ProfileSchema),
          signal,
        })
      ).data,
  });
}

/** A person's employment history and service totals (their page's Employment tab). */
export function usePersonProfiles(personId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: personKeys.sub(personId, 'employment-profiles'),
    queryFn: async ({ signal }) =>
      (await api.get(`/persons/${personId}/employment-profiles`, { schema: z.array(ProfileSchema), signal }))
        .data,
  });
}

export function usePersonServiceSummary(personId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: personKeys.sub(personId, 'service-summary'),
    queryFn: async ({ signal }) =>
      (await api.get(`/persons/${personId}/service-summary`, { schema: ServiceSummarySchema, signal })).data,
  });
}

/** A short-lived link to show a person's photograph; fetched when shown. */
export function usePhotoLink(documentId: string | null) {
  return useQuery({
    queryKey: profileKeys.sub(documentId ?? '', 'photo-url'),
    enabled: documentId !== null,
    staleTime: 2 * 60_000,
    gcTime: 2 * 60_000,
    queryFn: async ({ signal }) =>
      (
        await api.get(`/documents/${documentId ?? ''}/download`, {
          schema: z.looseObject({ url: z.string() }),
          signal,
        })
      ).data.url,
  });
}

/** What the profile form sends: what may change after creation (the person, estate and type never do). */
export interface ProfileInput {
  readonly profile_number: string | null;
  readonly category_id: string | null;
  readonly engagement_type: Profile['engagement_type'];
  readonly employment_basis: Profile['employment_basis'];
  readonly job_nature: Profile['job_nature'];
  readonly working_location: Profile['working_location'];
  readonly job_grade_id: string | null;
  readonly work_email: string | null;
  readonly joining_date: string;
  readonly confirmation_date: string | null;
  readonly probation_end_date: string | null;
  readonly supervisor_profile_id: string | null;
  readonly is_service_continuous: boolean;
  readonly nominee_name: string | null;
  readonly nominee_relation: Profile['nominee_relation'];
  readonly nominee_date_of_birth: string | null;
  readonly nominee_national_id: string | null;
  readonly nominee_phone: string | null;
  readonly nominee_address: string | null;
  readonly remarks: string | null;
}

export interface NewProfileInput extends Omit<ProfileInput, 'profile_number'> {
  readonly person_id: string;
  readonly estate_id: string;
  readonly employment_type: EmploymentType;
  /** Left out, the server numbers it (WRK-DEMO-A-2026-00001). */
  readonly profile_number?: string;
}

export function useCreateProfile() {
  return useApiMutation({
    mutationFn: async (input: NewProfileInput) =>
      (await api.post('/employment-profiles', input, { schema: ProfileSchema })).data,
    invalidates: () => [profileKeys.all, personKeys.all],
  });
}

type Versioned = Pick<Profile, 'id' | 'version' | 'profile_number'>;

export function useUpdateProfile(profile: Versioned) {
  return useApiMutation({
    mutationFn: async (input: ProfileInput & { profile_number: string }) =>
      (
        await api.put(`/employment-profiles/${profile.id}`, input, {
          schema: ProfileSchema,
          ifMatch: profile.version,
        })
      ).data,
    invalidates: () => [profileKeys.all, personKeys.all],
    conflictSubject: () => profile.profile_number,
  });
}

/** Suspend or reinstate (employment.edit), with the reason. */
export function useSuspension(profile: Versioned) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: { action: 'suspend' | 'reinstate'; reason: string }) =>
      (
        await api.post(
          `/employment-profiles/${profile.id}/${input.action}`,
          { reason: input.reason },
          {
            schema: ProfileSchema,
            versioned: true,
            ifMatch: profile.version,
            idempotencyKey: idempotency.key(),
          },
        )
      ).data,
    invalidates: () => [profileKeys.all, personKeys.all],
    conflictSubject: () => profile.profile_number,
    onSuccess: idempotency.reset,
  });
}

/** End the employment (employment.approve): the date, the kind and the reason. The profile becomes read-only. */
export function useSeparate(profile: Versioned) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (input: {
      separation_date: string;
      separation_type: (typeof SEPARATION_TYPES)[number];
      reason: string;
    }) =>
      (
        await api.post(`/employment-profiles/${profile.id}/separate`, input, {
          schema: ProfileSchema,
          versioned: true,
          ifMatch: profile.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => [profileKeys.all, personKeys.all],
    conflictSubject: () => profile.profile_number,
    onSuccess: idempotency.reset,
  });
}

/** Delete a profile (employment.delete): only one nothing refers to. */
export function useDeleteProfile(profile: Pick<Profile, 'id'>) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/employment-profiles/${profile.id}`);
    },
    invalidates: () => [profileKeys.lists()],
  });
}

/** One estate's worker profiles that are not separated, to choose team members from. */
export function useEstateWorkers(estateId: string | null) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: profileKeys.list(`workers:${estateId ?? ''}`),
    enabled: estateId !== null && estateId !== '',
    queryFn: async ({ signal }) =>
      (
        await api.get('/employment-profiles', {
          query: {
            'filter[estate_id]': estateId ?? '',
            'filter[employment_type]': 'worker',
            'filter[status][in]': 'active,suspended,on_leave',
            per_page: 200,
            sort: 'profile_number',
          },
          schema: z.array(ProfileSchema),
          signal,
        })
      ).data,
  });
}

/** One page of a search of employment profiles for a picker (a covering colleague, someone else's leave). */
export async function searchProfiles(query: string, cursor: string | null, signal: AbortSignal) {
  const pageNumber = cursor === null ? 1 : Number.parseInt(cursor, 10);
  const response = await api.get('/employment-profiles', {
    query: {
      'filter[q]': query,
      'filter[status][in]': 'active,suspended,on_leave',
      per_page: 20,
      page: pageNumber,
      sort: 'profile_number',
    },
    schema: z.array(ProfileSchema),
    signal,
  });
  const pagination = response.meta?.pagination;
  return {
    items: response.data.map((profile) => ({
      id: profile.id,
      label: `${profile.person.full_name} (${profile.profile_number})`,
      description: profile.estate.code,
    })),
    nextCursor: pagination && pagination.page < pagination.last_page ? String(pagination.page + 1) : null,
  };
}
