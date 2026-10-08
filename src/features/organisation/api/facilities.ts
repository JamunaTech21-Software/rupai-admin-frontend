import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api, useIdempotencyKey } from '@/lib/api';
import { cachePolicy, createQueryKeys, useApiMutation, usePagedList } from '@/lib/query';

import { factoryKeys, partyKeys, warehouseKeys } from './hierarchy';
import {
  type Contact,
  ContactSchema,
  type Factory,
  FactorySchema,
  type Party,
  PartySchema,
  type Warehouse,
  WarehouseSchema,
} from './schemas';

/**
 * Factories, warehouses, parties (P1.08) and the contacts of warehouses and parties. Edits send If-Match;
 * deactivate / reactivate / delete go through the shared node hooks (api/hierarchy.ts).
 */

// ---- Factories ------------------------------------------------------------------------------------------

export function useFactoriesList() {
  return usePagedList({
    keys: factoryKeys,
    path: '/factories',
    row: FactorySchema,
    defaultSort: 'code',
    pageSize: 25,
  });
}

export function useFactory(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: factoryKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/factories/${id}`, { schema: FactorySchema, signal })).data,
  });
}

export type FactoryInput = Omit<
  Factory,
  'id' | 'manager_profile_id' | 'status' | 'version' | 'created_at' | 'updated_at'
>;

export function useCreateFactory() {
  return useApiMutation({
    mutationFn: async (input: FactoryInput) =>
      (await api.post('/factories', input, { schema: FactorySchema })).data,
    invalidates: () => [factoryKeys.all],
  });
}

export function useUpdateFactory(factory: Factory) {
  return useApiMutation({
    mutationFn: async (input: FactoryInput) =>
      (
        await api.put(
          `/factories/${factory.id}`,
          { ...input, manager_profile_id: factory.manager_profile_id },
          { schema: FactorySchema, ifMatch: factory.version },
        )
      ).data,
    invalidates: () => [factoryKeys.all],
    conflictSubject: () => factory.name,
  });
}

// ---- Warehouses -----------------------------------------------------------------------------------------

export function useWarehousesList() {
  return usePagedList({
    keys: warehouseKeys,
    path: '/warehouses',
    row: WarehouseSchema,
    defaultSort: 'code',
    pageSize: 25,
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: warehouseKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await api.get(`/warehouses/${id}`, { schema: WarehouseSchema, signal })).data,
  });
}

/** phone is not sent: it is the primary contact's (sending it is 422). */
export type WarehouseInput = Omit<
  Warehouse,
  'id' | 'keeper_profile_id' | 'phone' | 'status' | 'version' | 'created_at' | 'updated_at'
>;

export function useCreateWarehouse() {
  return useApiMutation({
    mutationFn: async (input: WarehouseInput) =>
      (await api.post('/warehouses', input, { schema: WarehouseSchema })).data,
    invalidates: () => [warehouseKeys.all],
  });
}

export function useUpdateWarehouse(warehouse: Warehouse) {
  return useApiMutation({
    mutationFn: async (input: WarehouseInput) =>
      (
        await api.put(
          `/warehouses/${warehouse.id}`,
          { ...input, keeper_profile_id: warehouse.keeper_profile_id },
          { schema: WarehouseSchema, ifMatch: warehouse.version },
        )
      ).data,
    invalidates: () => [warehouseKeys.all],
    conflictSubject: () => warehouse.name,
  });
}

// ---- Parties (landowners, lessees, …; permissions land.*) ----------------------------------------------

export function usePartiesList() {
  return usePagedList({
    keys: partyKeys,
    path: '/parties',
    row: PartySchema,
    defaultSort: 'code',
    pageSize: 25,
  });
}

export function useParty(id: string) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: partyKeys.detail(id),
    queryFn: async ({ signal }) => (await api.get(`/parties/${id}`, { schema: PartySchema, signal })).data,
  });
}

export type PartyInput = Omit<Party, 'id' | 'status' | 'version' | 'created_at' | 'updated_at'>;

export function useCreateParty() {
  return useApiMutation({
    mutationFn: async (input: PartyInput) =>
      (await api.post('/parties', input, { schema: PartySchema })).data,
    invalidates: () => [partyKeys.all],
  });
}

export function useUpdateParty(party: Party) {
  return useApiMutation({
    mutationFn: async (input: PartyInput) =>
      (await api.put(`/parties/${party.id}`, input, { schema: PartySchema, ifMatch: party.version })).data,
    invalidates: () => [partyKeys.all],
    conflictSubject: () => party.name,
  });
}

// ---- Contacts (one API for every owner: /warehouses/{id}/contacts, /parties/{id}/contacts, …) ------------

/** The owner of a contacts list, as its API path: `warehouses/3`. Later owners (buyers, brokers) reuse this. */
export interface ContactOwner {
  readonly path: 'warehouses' | 'parties';
  readonly id: string;
}

export const contactKeys = createQueryKeys('contacts');
const ownerKey = (owner: ContactOwner) => `${owner.path}/${owner.id}`;
/** A contact change can change the owner's phone (warehouse.phone is the primary contact's). */
const contactInvalidation = (owner: ContactOwner) => [
  contactKeys.list(ownerKey(owner)),
  owner.path === 'warehouses' ? warehouseKeys.all : partyKeys.all,
];

export function useContacts(owner: ContactOwner) {
  return useQuery({
    ...cachePolicy('master'),
    queryKey: contactKeys.list(ownerKey(owner)),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/${owner.path}/${owner.id}/contacts`, {
          query: { per_page: 100 },
          schema: z.array(ContactSchema),
          signal,
        })
      ).data,
  });
}

export interface ContactInput {
  readonly contact_name: string;
  readonly designation: string | null;
  readonly contact_type: Contact['contact_type'];
  readonly phone: string | null;
  readonly phone_alt: string | null;
  readonly email: string | null;
}

export function useCreateContact(owner: ContactOwner) {
  return useApiMutation({
    mutationFn: async (input: ContactInput & { is_primary?: boolean }) =>
      (await api.post(`/${owner.path}/${owner.id}/contacts`, input, { schema: ContactSchema })).data,
    invalidates: () => contactInvalidation(owner),
  });
}

export function useUpdateContact(owner: ContactOwner, contact: Contact) {
  return useApiMutation({
    mutationFn: async (input: ContactInput) =>
      (
        await api.put(`/${owner.path}/${owner.id}/contacts/${contact.id}`, input, {
          schema: ContactSchema,
          ifMatch: contact.version,
        })
      ).data,
    invalidates: () => contactInvalidation(owner),
    conflictSubject: () => contact.contact_name,
  });
}

/** Make a contact the owner's primary one (If-Match, Idempotency-Key): the previous primary stops being it. */
export function useMakePrimaryContact(owner: ContactOwner, contact: Contact) {
  const idempotency = useIdempotencyKey();
  return useApiMutation({
    mutationFn: async () =>
      (
        await api.post(`/${owner.path}/${owner.id}/contacts/${contact.id}/make-primary`, undefined, {
          schema: ContactSchema,
          versioned: true,
          ifMatch: contact.version,
          idempotencyKey: idempotency.key(),
        })
      ).data,
    invalidates: () => contactInvalidation(owner),
    conflictSubject: () => contact.contact_name,
    onSuccess: idempotency.reset,
  });
}

export function useDeleteContact(owner: ContactOwner, contact: Contact) {
  return useApiMutation({
    mutationFn: async () => {
      await api.delete(`/${owner.path}/${owner.id}/contacts/${contact.id}`);
    },
    invalidates: () => contactInvalidation(owner),
  });
}
