import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import { type Dependent, DependentSchema, type Person, PersonSchema, type RELATIONS } from './schemas';

export const personKeys = createQueryKeys('persons');

/** Every person the user may see (person.view), a page at a time; the server filters by estate scope. */
export function usePersonsList() {
  return usePagedList({
    keys: personKeys,
    path: '/persons',
    row: PersonSchema,
    defaultSort: 'full_name',
    pageSize: 25,
  });
}

export function usePerson(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: personKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/persons/${id}`, { schema: PersonSchema, signal })).data,
  });
}

/** What a person form sends: the identity fields; `skill_ids` and `language_ids` replace the previous sets. */
export interface PersonInput {
  readonly registered_estate_id: string | null;
  readonly title: Person['title'];
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly last_name: string | null;
  readonly father_name: string | null;
  readonly mother_name: string | null;
  readonly spouse_name: string | null;
  readonly date_of_birth: string | null;
  readonly gender: Person['gender'];
  readonly marital_status: Person['marital_status'];
  readonly blood_group: Person['blood_group'];
  readonly nationality_country_id: string | null;
  readonly religion_id: string | null;
  readonly national_id: string | null;
  readonly birth_certificate_no: string | null;
  readonly passport_no: string | null;
  readonly driving_license_no: string | null;
  readonly tin: string | null;
  readonly phone: string | null;
  readonly alternate_phone: string | null;
  readonly personal_email: string | null;
  readonly present_address: string | null;
  readonly present_district: string | null;
  readonly present_upazila: string | null;
  readonly present_postal_code: string | null;
  readonly permanent_address: string | null;
  readonly permanent_district: string | null;
  readonly permanent_upazila: string | null;
  readonly permanent_postal_code: string | null;
  readonly education_level_id: string | null;
  readonly skill_ids: readonly string[];
  readonly language_ids: readonly string[];
  readonly experience_years: number | null;
  readonly emergency_contact_name: string | null;
  readonly emergency_contact_phone: string | null;
  readonly emergency_contact_alt_phone: string | null;
  readonly emergency_contact_relation: Person['emergency_contact_relation'];
  readonly emergency_contact_address: string | null;
  readonly payment_method: Person['payment_method'];
  readonly bank_name: string | null;
  readonly bank_branch: string | null;
  readonly bank_account_number: string | null;
  readonly mobile_banking_provider: Person['mobile_banking_provider'];
  readonly mobile_banking_number: string | null;
  readonly remarks: string | null;
}

export function useCreatePerson() {
  return useApiMutation({
    mutationFn: async (input: PersonInput) =>
      (await api.post('/persons', input, { schema: PersonSchema })).data,
    invalidates: () => [personKeys.all],
  });
}

export function useUpdatePerson(person: Pick<Person, 'id' | 'version' | 'full_name'>) {
  return useApiMutation({
    mutationFn: async (input: PersonInput) =>
      (await api.put(`/persons/${person.id}`, input, { schema: PersonSchema, ifMatch: person.version })).data,
    invalidates: () => [personKeys.all],
    conflictSubject: () => person.full_name,
  });
}

/** Deactivate or reactivate (POST /persons/{id}/deactivate|reactivate, If-Match, Idempotency-Key). */
export function useSetPersonStatus(person: Pick<Person, 'id' | 'version' | 'full_name'>) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'deactivate' | 'reactivate') => {
      await api.post(`/persons/${person.id}/${action}`, undefined, {
        versioned: true,
        ifMatch: person.version,
        idempotencyKey: idempotency.key(),
      });
    },
    invalidates: () => [personKeys.all],
    conflictSubject: () => person.full_name,
    onSuccess: idempotency.reset,
  });
}

/** Delete a person. 422 REFERENCED_RECORD when a profile or record refers to them: deactivate instead. */
export function useDeletePerson(person: Pick<Person, 'id'>) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/persons/${person.id}`);
    },
    // Lists only: the deleted person's own query must not refetch (it would 404 before the page leaves).
    invalidates: () => [personKeys.lists()],
  });
}

// ---- Dependents (the design's Dependent / Family Member tab) ---------------------------------------------

const dependentsKey = (personId: string) => personKeys.sub(personId, 'dependents');

export function usePersonDependents(personId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: dependentsKey(personId),
    queryFn: async ({ signal }) =>
      (await api.get(`/persons/${personId}/dependents`, { schema: z.array(DependentSchema), signal })).data,
  });
}

export interface DependentInput {
  readonly name: string;
  readonly relation: (typeof RELATIONS)[number];
  readonly occupation: string | null;
  readonly date_of_birth: string | null;
  readonly gender: Dependent['gender'];
}

export function useAddDependent(personId: string) {
  return useApiMutation({
    mutationFn: async (input: DependentInput) =>
      (await api.post(`/persons/${personId}/dependents`, input, { schema: DependentSchema })).data,
    // The person's own count of dependents changes with the list.
    invalidates: () => [dependentsKey(personId), personKeys.all],
  });
}

export function useChangeDependent(personId: string, dependent: Pick<Dependent, 'id' | 'version' | 'name'>) {
  return useApiMutation({
    mutationFn: async (input: DependentInput) =>
      (
        await api.patch(`/persons/${personId}/dependents/${dependent.id}`, input, {
          schema: DependentSchema,
          ifMatch: dependent.version,
        })
      ).data,
    invalidates: () => [dependentsKey(personId)],
    conflictSubject: () => dependent.name,
  });
}

export function useRemoveDependent(personId: string, dependent: Pick<Dependent, 'id'>) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/persons/${personId}/dependents/${dependent.id}`);
    },
    invalidates: () => [dependentsKey(personId), personKeys.all],
  });
}
