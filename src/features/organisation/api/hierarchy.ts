import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import {
  type Division,
  DivisionSchema,
  type Estate,
  EstateSchema,
  type Field,
  FieldSchema,
  type Organisation,
  OrganisationSchema,
  type Section,
  SectionSchema,
} from './schemas';

/**
 * Hooks for the organisation hierarchy (P1.07). Every edit, deactivate, reactivate and reassign sends If-Match
 * with the version read; status changes also send an Idempotency-Key.
 */

export const organisationKeys = createQueryKeys('organisation');
export const estateKeys = createQueryKeys('estates');
export const divisionKeys = createQueryKeys('divisions');
export const sectionKeys = createQueryKeys('sections');
export const fieldKeys = createQueryKeys('fields');
export const factoryKeys = createQueryKeys('factories');
export const warehouseKeys = createQueryKeys('warehouses');
export const partyKeys = createQueryKeys('parties');

/** Anything under an estate can change its children lists and the fields list. */
const hierarchyLists = () => [
  estateKeys.all,
  divisionKeys.all,
  sectionKeys.all,
  fieldKeys.all,
  factoryKeys.all,
  warehouseKeys.all,
  partyKeys.all,
];

// ---- Organisation (singleton) ---------------------------------------------------------------------------

export function useOrganisation() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: organisationKeys.detail('current'),
    queryFn: async ({ signal }) =>
      (await api.get('/organisation', { schema: OrganisationSchema, signal })).data,
  });
}

export type OrganisationInput = Omit<
  Organisation,
  'id' | 'country_id' | 'logo_path' | 'base_currency_id' | 'status' | 'version' | 'updated_at'
>;

export function useUpdateOrganisation(organisation: Organisation) {
  return useApiMutation({
    mutationFn: async (input: OrganisationInput) =>
      (await api.put('/organisation', input, { schema: OrganisationSchema, ifMatch: organisation.version }))
        .data,
    invalidates: () => [organisationKeys.all],
    conflictSubject: () => organisation.name,
  });
}

// ---- Status changes and deletes, shared by every node --------------------------------------------------

export type NodePath =
  'estates' | 'divisions' | 'sections' | 'fields' | 'factories' | 'warehouses' | 'parties';
interface Versioned {
  readonly id: string;
  readonly version: number;
}

/** Deactivate or reactivate a node (POST /{path}/{id}/deactivate|reactivate, If-Match, Idempotency-Key). */
export function useSetNodeStatus(path: NodePath, node: Versioned, subject: string) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async (action: 'deactivate' | 'reactivate') => {
      await api.post(`/${path}/${node.id}/${action}`, undefined, {
        versioned: true,
        ifMatch: node.version,
        idempotencyKey: idempotency.key(),
      });
    },
    invalidates: hierarchyLists,
    conflictSubject: () => subject,
    onSuccess: idempotency.reset,
  });
}

/** Delete a node. 422 REFERENCED_RECORD when it has children, fields or scope grants: deactivate instead. */
export function useDeleteNode(path: NodePath, node: Versioned) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/${path}/${node.id}`);
    },
    // Lists only: the deleted record's own query must not refetch (it would 404 before the page leaves).
    invalidates: () => [
      estateKeys.lists(),
      divisionKeys.lists(),
      sectionKeys.lists(),
      fieldKeys.lists(),
      factoryKeys.lists(),
      warehouseKeys.lists(),
      partyKeys.lists(),
    ],
  });
}

// ---- Estates ------------------------------------------------------------------------------------------------

export function useEstatesList() {
  return usePagedList({
    keys: estateKeys,
    path: '/estates',
    row: EstateSchema,
    defaultSort: 'code',
    pageSize: 25,
  });
}

/** Every estate the user may see (pickers and labels): one page of 200 covers any organisation. */
export function useAllEstates() {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateKeys.list('all'),
    queryFn: async ({ signal }) =>
      (
        await api.get('/estates', {
          query: { per_page: 200, sort: 'code' },
          schema: z.array(EstateSchema),
          signal,
        })
      ).data,
  });
}

export function useEstate(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: estateKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/estates/${id}`, { schema: EstateSchema, signal })).data,
  });
}

export type EstateInput = Omit<
  Estate,
  'id' | 'organisation_id' | 'manager_profile_id' | 'status' | 'version' | 'created_at' | 'updated_at'
>;

export function useCreateEstate() {
  return useApiMutation({
    mutationFn: async (input: EstateInput) =>
      (await api.post('/estates', input, { schema: EstateSchema })).data,
    invalidates: () => [estateKeys.all],
  });
}

export function useUpdateEstate(estate: Estate) {
  return useApiMutation({
    mutationFn: async (input: EstateInput) =>
      (
        await api.put(
          `/estates/${estate.id}`,
          { ...input, manager_profile_id: estate.manager_profile_id },
          { schema: EstateSchema, ifMatch: estate.version },
        )
      ).data,
    invalidates: () => [estateKeys.all],
    conflictSubject: () => estate.name,
  });
}

// ---- Divisions and sections ---------------------------------------------------------------------------------

export function useDivisions(estateId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: divisionKeys.list(`estate:${estateId}`),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/estates/${estateId}/divisions`, {
          query: { per_page: 200, sort: 'code' },
          schema: z.array(DivisionSchema),
          signal,
        })
      ).data,
    enabled: estateId !== '',
  });
}

export function useSections(divisionId: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: sectionKeys.list(`division:${divisionId}`),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/divisions/${divisionId}/sections`, {
          query: { per_page: 200, sort: 'code' },
          schema: z.array(SectionSchema),
          signal,
        })
      ).data,
    enabled: divisionId !== '',
  });
}

export function useDivision(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: divisionKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/divisions/${id}`, { schema: DivisionSchema, signal })).data,
    enabled: id !== '',
  });
}

export function useSection(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: sectionKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/sections/${id}`, { schema: SectionSchema, signal })).data,
    enabled: id !== '',
  });
}

/** Division and section forms share these fields (the manager / supervisor arrives with HR, Phase 2). */
export interface NodeInput {
  readonly code: string;
  readonly name: string;
  readonly area: string | null;
}

/** Create a division under an estate, or a section under a division. */
export function useCreateNode(kind: 'division' | 'section', parentId: string) {
  return useApiMutation({
    mutationFn: async (input: NodeInput) => {
      if (kind === 'division') {
        return (await api.post(`/estates/${parentId}/divisions`, input, { schema: DivisionSchema })).data;
      }
      return (await api.post(`/divisions/${parentId}/sections`, input, { schema: SectionSchema })).data;
    },
    invalidates: hierarchyLists,
  });
}

export function useUpdateNode(kind: 'division' | 'section', node: Division | Section) {
  return useApiMutation({
    mutationFn: async (input: NodeInput) => {
      if (kind === 'division') {
        const body = { ...input, manager_profile_id: (node as Division).manager_profile_id };
        return (
          await api.put(`/divisions/${node.id}`, body, { schema: DivisionSchema, ifMatch: node.version })
        ).data;
      }
      const body = { ...input, supervisor_profile_id: (node as Section).supervisor_profile_id };
      return (await api.put(`/sections/${node.id}`, body, { schema: SectionSchema, ifMatch: node.version }))
        .data;
    },
    invalidates: hierarchyLists,
    conflictSubject: () => node.name,
  });
}

// ---- Fields ---------------------------------------------------------------------------------------------

export function useFieldsList() {
  return usePagedList({
    keys: fieldKeys,
    path: '/fields',
    row: FieldSchema,
    defaultSort: 'field_number',
    pageSize: 25,
  });
}

export function useField(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: fieldKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/fields/${id}`, { schema: FieldSchema, signal })).data,
  });
}

export interface FieldInput {
  readonly field_number: string;
  readonly name: string | null;
  readonly gross_area: string;
  readonly planted_area: string | null;
  readonly field_status: Field['field_status'];
  readonly remarks: string | null;
}

/** Create a field. The section decides the estate: estate_id is never sent. */
export function useCreateField() {
  return useApiMutation({
    mutationFn: async (input: FieldInput & { section_id: string; section_effective_from?: string }) =>
      (await api.post('/fields', input, { schema: FieldSchema })).data,
    invalidates: () => [fieldKeys.all],
  });
}

export function useUpdateField(field: Field) {
  return useApiMutation({
    mutationFn: async (input: FieldInput) =>
      (await api.put(`/fields/${field.id}`, input, { schema: FieldSchema, ifMatch: field.version })).data,
    invalidates: () => [fieldKeys.all],
    conflictSubject: () => field.field_number,
  });
}

/** Move a field to another section of the same estate, from a date (effective-dated; If-Match). */
export function useReassignField(field: Field) {
  return useApiMutation({
    mutationFn: async (input: { section_id: string; effective_from: string; reason?: string }) =>
      (
        await api.post(`/fields/${field.id}/reassign-section`, input, {
          schema: FieldSchema,
          versioned: true,
          ifMatch: field.version,
        })
      ).data,
    invalidates: () => [fieldKeys.all],
    conflictSubject: () => field.field_number,
  });
}
